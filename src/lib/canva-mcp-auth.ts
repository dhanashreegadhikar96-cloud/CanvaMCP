// Sign-in for Canva's MCP server (https://mcp.canva.com/mcp), which has the design editor
// (boxes, text, arrows…). It's a separate sign-in from the REST API one (canva-auth.ts): Canva
// issues different tokens for the two.
//
// The app registers itself with Canva's MCP server once (OAuth dynamic client registration; Canva
// calls this deprecated but still supported) and keeps the client ID in .canva-mcp-client.json
// (or CANVA_MCP_CLIENT_ID). Users then sign in with PKCE; tokens live in httpOnly cookies.
import { readFile, writeFile } from "node:fs/promises";
import { appOrigin } from "./canva-auth";

export const MCP_URL = "https://mcp.canva.com/mcp";
const AUTH_BASE = "https://mcp.canva.com";
const CLIENT_FILE = ".canva-mcp-client.json";

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
  client: "canva_mcp_client", // which registration (client ID) this sign-in belongs to
} as const;
export const MCP_VERIFIER_COOKIE = COOKIE.verifier;

/** Callback for the editor sign-in on this request's address (127.0.0.1 locally, your domain when deployed). */
export function mcpRedirectUri(request?: Request): string {
  return process.env.CANVA_MCP_REDIRECT_URI || `${appOrigin(request)}/api/auth/canva-mcp/callback`;
}

// Registrations are per callback URL (local and deployed each need their own). Kept in memory and,
// where the disk is writable (local dev), in .canva-mcp-client.json as { [redirect_uri]: client_id }.
const registered = new Map<string, string>();

/**
 * The app's client ID at Canva's MCP server for this callback URL, registering the app the first time.
 * On Vercel the disk isn't writable, so set CANVA_MCP_CLIENT_ID (registered for the deployed callback)
 * to avoid a new registration after every cold start.
 */
export async function mcpClientId(redirect: string): Promise<string> {
  // Developer Portal route (Canva's supported one): your app has "Canva MCP" turned on, so the editor
  // signs in with the same client ID (and secret) as the REST API. Needed for non-local addresses:
  // Canva's MCP server only accepts 127.0.0.1-style redirect URLs from self-registered clients.
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

/**
 * True when CANVA_MCP_USE_PORTAL_APP=true: the editor uses your Developer Portal app (client ID + secret)
 * instead of self-registration. Turn on "Canva MCP" for the app and add the editor callback URLs
 * (…/api/auth/canva-mcp/callback) to its Redirect URLs first.
 */
export function usePortalApp(): boolean {
  return process.env.CANVA_MCP_USE_PORTAL_APP === "true" && Boolean(process.env.CANVA_CLIENT_ID && process.env.CANVA_CLIENT_SECRET);
}

/** Token request at Canva's MCP server, for the registration (clientId) the user signed in with. */
export async function requestMcpToken(clientId: string, params: Record<string, string>): Promise<TokenResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  // The Developer Portal app is a confidential client: it proves itself with its secret
  // (client_secret_basic, which mcp.canva.com lists as supported). Self-registered clients have no secret.
  if (usePortalApp() && clientId === process.env.CANVA_CLIENT_ID) {
    headers.Authorization = `Basic ${Buffer.from(`${process.env.CANVA_CLIENT_ID}:${process.env.CANVA_CLIENT_SECRET}`).toString("base64")}`;
  }
  const res = await fetch(`${AUTH_BASE}/token`, {
    method: "POST",
    headers,
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
    throw new Error("Canva's editor token is too large to keep in a cookie. Tell the developer (needs a server-side token store).");
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

/** A usable MCP access token (renewed when it has expired), or null when the user must connect the editor. */
export async function getMcpAccessToken(cookies: CookieStore): Promise<string | null> {
  const access = cookies.get(COOKIE.access)?.value;
  const expires = Number(cookies.get(COOKIE.expires)?.value || 0);
  if (access && expires - Date.now() > 60_000) return access;
  const refresh = cookies.get(COOKIE.refresh)?.value;
  if (!refresh) return access ?? null;
  try {
    // Sign-ins from before the client cookie existed were made with the local registration
    const clientId = cookies.get(COOKIE.client)?.value || (await mcpClientId(mcpRedirectUri()));
    const token = await requestMcpToken(clientId, { grant_type: "refresh_token", refresh_token: refresh });
    saveMcpTokens(cookies, token, clientId);
    return token.access_token;
  } catch (err) {
    console.error("[canva editor] couldn't renew the sign-in:", err instanceof Error ? err.message : err);
    lastRefreshError.mcp = err instanceof Error ? err.message : String(err);
    return null;
  }
}
