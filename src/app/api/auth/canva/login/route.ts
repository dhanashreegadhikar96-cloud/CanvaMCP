import { NextResponse } from "next/server";
import crypto from "crypto";
import { AUTHORIZE_URL, SCOPES, VERIFIER_COOKIE, appOrigin, credentials, redirectUri } from "@/lib/canva-auth";

// Starts "Connect Canva": sends the browser to Canva's sign-in with a PKCE challenge.

const base64Url = (buffer: Buffer) => buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export async function GET(request: Request) {
  // The verifier cookie must be set on the same host Canva sends the user back to (127.0.0.1 locally).
  // The Host header is what the browser actually used; request.url says localhost in dev either way.
  const host = request.headers.get("host");
  const origin = appOrigin();
  if (host && host !== new URL(origin).host) {
    return NextResponse.redirect(`${origin}/api/auth/canva/login`);
  }

  if (!credentials()) {
    return NextResponse.redirect(`${origin}/connector/canva?error=${encodeURIComponent("Canva isn't set up on the server yet (CANVA_CLIENT_ID / CANVA_CLIENT_SECRET).")}`);
  }

  const verifier = base64Url(crypto.randomBytes(48));
  const challenge = base64Url(crypto.createHash("sha256").update(verifier).digest());
  const state = base64Url(crypto.randomBytes(16));

  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "s256");
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", credentials()!.clientId);
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("state", state);

  const response = NextResponse.redirect(url.toString());
  response.cookies.set(VERIFIER_COOKIE, `${state}.${verifier}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/",
  });
  return response;
}
