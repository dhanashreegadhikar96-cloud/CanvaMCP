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
} as const;
export const MCP_VERIFIER_COOKIE = COOKIE.verifier;

export function mcpRedirectUri(): string {
  return process.env.CANVA_MCP_REDIRECT_URI || `${appOrigin()}/api/auth/canva-mcp/callback`;
}

/** The app's client ID at Canva's MCP server, registering the app the first time it's needed. */
export async function mcpClientId(): Promise<string> {
  if (process.env.CANVA_MCP_CLIENT_ID) return process.env.CANVA_MCP_CLIENT_ID;
  const redirect = mcpRedirectUri();
  try {
    const saved = JSON.parse(await readFile(CLIENT_FILE, "utf8"));
    if (saved.client_id && saved.redirect_uri === redirect) return saved.client_id;
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
  await writeFile(CLIENT_FILE, JSON.stringify({ client_id: client.client_id, redirect_uri: redirect }, null, 2)).catch(() => undefined);
  return client.client_id;
}

export function mcpAuthorizeUrl(clientId: string, challenge: string, state: string): string {
  const url = new URL(`${AUTH_BASE}/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", mcpRedirectUri());
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);
  url.searchParams.set("scope", MCP_SCOPES.join(" "));
  url.searchParams.set("resource", MCP_URL);
  return url.toString();
}

type TokenResponse = { access_token: string; refresh_token?: string; expires_in?: number };

export async function requestMcpToken(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${AUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...params, client_id: await mcpClientId(), resource: MCP_URL }).toString(),
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

export function saveMcpTokens(cookies: CookieWriter, token: TokenResponse) {
  // Browsers drop cookies over ~4 KB; fail loudly rather than lose the sign-in silently
  if (token.access_token.length > 3800 || (token.refresh_token?.length ?? 0) > 3800) {
    throw new Error("Canva's editor token is too large to keep in a cookie. Tell the developer (needs a server-side token store).");
  }
  const expiresIn = token.expires_in ?? 60 * 60;
  cookies.set(COOKIE.access, token.access_token, cookieOptions(expiresIn));
  cookies.set(COOKIE.expires, String(Date.now() + expiresIn * 1000), cookieOptions(30 * 24 * 60 * 60));
  if (token.refresh_token) cookies.set(COOKIE.refresh, token.refresh_token, cookieOptions(30 * 24 * 60 * 60));
}

export const MCP_TOKEN_COOKIES = [COOKIE.access, COOKIE.refresh, COOKIE.expires];

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
    const token = await requestMcpToken({ grant_type: "refresh_token", refresh_token: refresh });
    saveMcpTokens(cookies, token);
    return token.access_token;
  } catch (err) {
    console.error("[canva editor] couldn't renew the sign-in:", err instanceof Error ? err.message : err);
    lastRefreshError.mcp = err instanceof Error ? err.message : String(err);
    return null;
  }
}
