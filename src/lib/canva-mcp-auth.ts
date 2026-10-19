// Sign-in for Canva MCP (Canva's AI tools, incl. the design editor: boxes, text, arrows…).
// It's a separate sign-in from the Canva REST API one (canva-auth.ts), with its own Connect button,
// callback (/api/auth/canva-mcp/callback) and cookies. Two routes, chosen by CANVA_MCP_USE_PORTAL_APP:
//
//  Portal route (CANVA_MCP_USE_PORTAL_APP=true):
//    Your Developer Portal app with "Canva MCP" turned on. Signs in through Canva's normal OAuth
//    (www.canva.com) with your client ID + secret; tools at api.canva.com/connect/v1/mcp.
//    Works on a deployed site. Like every Developer Portal app, only the owner (and collaborators) can
//    sign in until the app is released ("The client ID is invalid" for anyone else).
//
//  Self-registered route (setting off):
//    The app registers itself with mcp.canva.com (OAuth dynamic client registration; deprecated but
//    supported) and keeps the client ID in .canva-mcp-client.json (or CANVA_MCP_CLIENT_ID). Doesn't use
//    your Developer Portal app, so any Canva account can sign in, but mcp.canva.com only accepts
//    127.0.0.1-style return addresses from such clients: works locally, not on a deployed site
//    ("Invalid redirect URI") unless Canva allowlists it (waitlist).
//
// Users sign in with PKCE; tokens live in httpOnly cookies.
import { readFile, writeFile } from "node:fs/promises";
import { AUTHORIZE_URL, SCOPES, appOrigin, requestToken } from "./canva-auth";

export const MCP_URL = "https://mcp.canva.com/mcp"; // self-registered / waitlist clients
export const PORTAL_MCP_URL = "https://api.canva.com/connect/v1/mcp"; // Developer Portal apps
const AUTH_BASE = "https://mcp.canva.com";
const CLIENT_FILE = ".canva-mcp-client.json";

// Scopes for the self-registered route (mcp.canva.com lists these as supported). The portal route uses
// the REST sign-in's SCOPES, which are ticked on your app; Canva refuses scopes that aren't ticked.
export const MCP_SCOPES = [
  "profile:read",
  "design:meta:read",
  "design:content:read",
  "design:content:write",
  "folder:read",
  "folder:write",
  "asset:read",
  "asset:write",
  "comment:read",
  "comment:write",
  "brandkit:read",
];

const COOKIE = {
  access: "canva_mcp_access",
  refresh: "canva_mcp_refresh",
  expires: "canva_mcp_expires",
  verifier: "canva_mcp_verifier",
  client: "canva_mcp_client", // which client (portal app or self-registration) this sign-in belongs to
} as const;
export const MCP_VERIFIER_COOKIE = COOKIE.verifier;

/** CANVA_MCP_USE_PORTAL_APP as a yes/no, forgiving about case, quotes and spaces ("true", "TRUE", "1", "yes"). */
export function portalSetting(): boolean {
  const value = (process.env.CANVA_MCP_USE_PORTAL_APP ?? "").trim().replace(/^["']|["']$/g, "").toLowerCase();
  return ["true", "1", "yes"].includes(value);
}

/** True when the MCP sign-in uses your Developer Portal app (see the top of this file). */
export function usePortalApp(): boolean {
  return portalSetting() && Boolean(process.env.CANVA_CLIENT_ID && process.env.CANVA_CLIENT_SECRET);
}

/** The MCP server to call for a sign-in made with this client ID. */
export function mcpServerFor(clientId: string | undefined): string {
  return clientId && clientId === process.env.CANVA_CLIENT_ID ? PORTAL_MCP_URL : MCP_URL;
}

/** Callback for the MCP sign-in on this request's address (127.0.0.1 locally, your domain when deployed). */
export function mcpRedirectUri(request?: Request): string {
  return process.env.CANVA_MCP_REDIRECT_URI || `${appOrigin(request)}/api/auth/canva-mcp/callback`;
}

// Self-registrations are per callback URL. Kept in memory and, where the disk is writable (local dev),
// in .canva-mcp-client.json as { [redirect_uri]: client_id }.
const registered = new Map<string, string>();

/**
 * The client ID for the MCP sign-in: your Developer Portal app (portal route), or the app's
 * self-registration at mcp.canva.com for this callback URL, registering the first time.
 */
export async function mcpClientId(redirect: string): Promise<string> {
  if (usePortalApp()) return process.env.CANVA_CLIENT_ID!;
  if (process.env.CANVA_MCP_CLIENT_ID) return process.env.CANVA_MCP_CLIENT_ID;
  if (registered.has(redirect)) return registered.get(redirect)!;
  let saved: Record<string, string> = {};
  try {
    const file = JSON.parse(await readFile(CLIENT_FILE, "utf8"));
    // older format: { client_id, redirect_uri }
    saved = file.client_id ? { [file.redirect_uri]: file.client_id } : file;
    if (saved[redirect]) {
      registered.set(redirect, saved[redirect]);
      return saved[redirect];
    }
  } catch {
    // not registered yet
  }
  const res = await fetch(`${AUTH_BASE}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "NSOffice Canva connector",
      redirect_uris: [redirect],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
  });
  if (!res.ok) throw new Error(`Canva's MCP server refused to register the app (${res.status}): ${await res.text()}`);
  const client = await res.json();
  registered.set(redirect, client.client_id);
  await writeFile(CLIENT_FILE, JSON.stringify({ ...saved, [redirect]: client.client_id }, null, 2)).catch(() => undefined);
  return client.client_id;
}

export function mcpAuthorizeUrl(clientId: string, redirect: string, challenge: string, state: string): string {
  if (clientId === process.env.CANVA_CLIENT_ID) {
    // Portal route: Canva's normal sign-in, like the REST API's
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "s256");
    url.searchParams.set("scope", SCOPES.join(" "));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirect);
    url.searchParams.set("state", state);
    return url.toString();
  }
  const url = new URL(`${AUTH_BASE}/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirect);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);
  url.searchParams.set("scope", MCP_SCOPES.join(" "));
  url.searchParams.set("resource", MCP_URL);
  return url.toString();
}

type TokenResponse = { access_token: string; refresh_token?: string; expires_in?: number };

/** Token request for the MCP sign-in, for the client (portal app or self-registration) it was made with. */
export async function requestMcpToken(clientId: string, params: Record<string, string>): Promise<TokenResponse> {
  // Portal route: same token endpoint and client secret as the REST sign-in
  if (clientId === process.env.CANVA_CLIENT_ID) return requestToken(params);

  const res = await fetch(`${AUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...params, client_id: clientId, resource: MCP_URL }).toString(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error_description || body.error || `Canva's MCP token endpoint returned ${res.status}`);
  }
  return res.json();
}

type CookieWriter = { set: (name: string, value: string, options: Record<string, unknown>) => unknown };
type CookieStore = CookieWriter & { get: (name: string) => { value: string } | undefined };

const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});

export function saveMcpTokens(cookies: CookieWriter, token: TokenResponse, clientId: string) {
  // Browsers drop cookies over ~4 KB; fail loudly rather than lose the sign-in silently
  if (token.access_token.length > 3800 || (token.refresh_token?.length ?? 0) > 3800) {
    throw new Error("Canva's MCP token is too large to keep in a cookie. Tell the developer (needs a server-side token store).");
  }
  const expiresIn = token.expires_in ?? 60 * 60;
  cookies.set(COOKIE.access, token.access_token, cookieOptions(expiresIn));
  cookies.set(COOKIE.expires, String(Date.now() + expiresIn * 1000), cookieOptions(30 * 24 * 60 * 60));
  if (token.refresh_token) cookies.set(COOKIE.refresh, token.refresh_token, cookieOptions(30 * 24 * 60 * 60));
  cookies.set(COOKIE.client, clientId, cookieOptions(30 * 24 * 60 * 60));
}

export const MCP_TOKEN_COOKIES = [COOKIE.access, COOKIE.refresh, COOKIE.expires, COOKIE.client];

/** The last sign-in renewal error (for the chat's debug log). */
export const lastRefreshError: { mcp?: string; rest?: string } = {};

export function isMcpConnected(cookies: Pick<CookieStore, "get">): boolean {
  return Boolean(cookies.get(COOKIE.access)?.value || cookies.get(COOKIE.refresh)?.value);
}

/** The client ID the current MCP sign-in was made with (decides which MCP server to call). */
export function mcpSignInClient(cookies: Pick<CookieStore, "get">): string | undefined {
  return cookies.get(COOKIE.client)?.value;
}

/** A usable MCP access token (renewed when it has expired), or null when the user must connect Canva MCP. */
export async function getMcpAccessToken(cookies: CookieStore): Promise<string | null> {
  const access = cookies.get(COOKIE.access)?.value;
  const expires = Number(cookies.get(COOKIE.expires)?.value || 0);
  if (access && expires - Date.now() > 60_000) return access;
  const refresh = cookies.get(COOKIE.refresh)?.value;
  if (!refresh) return access ?? null;
  try {
    // Sign-ins from before the client cookie existed were made with the local self-registration
    const clientId = cookies.get(COOKIE.client)?.value || (await mcpClientId(mcpRedirectUri()));
    const token = await requestMcpToken(clientId, { grant_type: "refresh_token", refresh_token: refresh });
    saveMcpTokens(cookies, token, clientId);
    return token.access_token;
  } catch (err) {
    console.error("[canva mcp] couldn't renew the sign-in:", err instanceof Error ? err.message : err);
    lastRefreshError.mcp = err instanceof Error ? err.message : String(err);
    return null;
  }
}
