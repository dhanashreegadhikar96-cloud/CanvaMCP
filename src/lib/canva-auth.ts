// Canva sign-in (OAuth with PKCE) for the Canva REST API: settings, token cookies and refresh.
// Tokens live in httpOnly cookies, so page scripts never see them.
import type { NextResponse } from "next/server";

export const TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";
export const AUTHORIZE_URL = "https://www.canva.com/api/oauth/authorize";

// Every scope here must also be ticked on the app's Outside Canva > Configuration page,
// or Canva refuses the sign-in.
export const SCOPES = [
  "design:meta:read",
  "design:content:read",
  "design:content:write",
  "folder:read",
  "folder:write",
  "asset:read",
  "asset:write",
  "profile:read",
];

const COOKIE = {
  access: "canva_access_token",
  refresh: "canva_refresh_token",
  expires: "canva_token_expires",
  verifier: "canva_oauth_verifier",
} as const;
export const VERIFIER_COOKIE = COOKIE.verifier;

/**
 * The app's public address, taken from the request: your Vercel domain when deployed
 * (x-forwarded-host), or 127.0.0.1 locally. Canva only accepts 127.0.0.1 redirect URLs for local
 * development, so localhost is turned into 127.0.0.1. CANVA_REDIRECT_URI overrides all of this.
 * (Use the Host header, not request.url: Next's dev server reports localhost in request.url.)
 */
export function appOrigin(request?: Request): string {
  if (process.env.CANVA_REDIRECT_URI) return new URL(process.env.CANVA_REDIRECT_URI).origin;
  const headers = request?.headers;
  const host = (headers?.get("x-forwarded-host") || headers?.get("host") || "127.0.0.1:3000").split(",")[0].trim();
  if (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) {
    return `http://${host.replace(/^localhost/, "127.0.0.1")}`;
  }
  const proto = (headers?.get("x-forwarded-proto") || "https").split(",")[0].trim();
  return `${proto}://${host}`;
}

/**
 * The callback URL sent to Canva. It must exactly match one of the app's
 * Outside Canva > Redirect URLs, e.g. http://127.0.0.1:3000/api/auth/canva/callback locally and
 * https://<your-app>.vercel.app/api/auth/canva/callback when deployed.
 */
export function redirectUri(request?: Request): string {
  return process.env.CANVA_REDIRECT_URI || `${appOrigin(request)}/api/auth/canva/callback`;
}

export function credentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.CANVA_CLIENT_ID;
  const clientSecret = process.env.CANVA_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

type TokenResponse = { access_token: string; refresh_token?: string; expires_in?: number };

/** Exchange an authorization code or a refresh token at Canva's token endpoint. */
export async function requestToken(params: Record<string, string>): Promise<TokenResponse> {
  const creds = credentials();
  if (!creds) throw new Error("CANVA_CLIENT_ID and CANVA_CLIENT_SECRET aren't set on the server.");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error_description || body.message || `Canva token endpoint returned ${res.status}`);
  }
  return res.json();
}

type CookieWriter = { set: (name: string, value: string, options: Record<string, unknown>) => unknown };

const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});

export function saveTokens(cookies: CookieWriter, token: TokenResponse) {
  const expiresIn = token.expires_in ?? 4 * 60 * 60;
  cookies.set(COOKIE.access, token.access_token, cookieOptions(expiresIn));
  cookies.set(COOKIE.expires, String(Date.now() + expiresIn * 1000), cookieOptions(30 * 24 * 60 * 60));
  // Canva refresh tokens are single-use: always keep the newest one
  if (token.refresh_token) cookies.set(COOKIE.refresh, token.refresh_token, cookieOptions(30 * 24 * 60 * 60));
}

export function clearTokens(response: NextResponse) {
  for (const name of [COOKIE.access, COOKIE.refresh, COOKIE.expires]) response.cookies.delete(name);
}

type CookieStore = CookieWriter & { get: (name: string) => { value: string } | undefined };

/** The last sign-in renewal error (for the chat's debug log). */
export const refreshErrors: { rest?: string } = {};

/** True when the user has signed in (a current or renewable token exists). */
export function isConnected(cookies: Pick<CookieStore, "get">): boolean {
  return Boolean(cookies.get(COOKIE.access)?.value || cookies.get(COOKIE.refresh)?.value);
}

/**
 * A usable access token, renewed with the refresh token when it has expired (or is about to).
 * Returns null when the user needs to connect again. Call from a route handler, where cookies can be set.
 */
export async function getAccessToken(cookies: CookieStore): Promise<string | null> {
  const access = cookies.get(COOKIE.access)?.value;
  const expires = Number(cookies.get(COOKIE.expires)?.value || 0);
  if (access && expires - Date.now() > 60_000) return access;

  const refresh = cookies.get(COOKIE.refresh)?.value;
  if (!refresh) return access ?? null;
  try {
    const token = await requestToken({ grant_type: "refresh_token", refresh_token: refresh });
    saveTokens(cookies, token);
    return token.access_token;
  } catch (err) {
    // refresh token expired or revoked: sign in again
    console.error("[canva] couldn't renew the sign-in:", err instanceof Error ? err.message : err);
    refreshErrors.rest = err instanceof Error ? err.message : String(err);
    return null;
  }
}

/** Revoke a token at Canva (best effort, used on disconnect). */
export async function revokeToken(token: string) {
  const creds = credentials();
  if (!creds) return;
  await fetch("https://api.canva.com/rest/v1/oauth/revoke", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ token }).toString(),
  }).catch(() => undefined);
}

export const REFRESH_COOKIE = COOKIE.refresh;
