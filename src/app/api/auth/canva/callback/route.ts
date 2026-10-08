import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CHAIN_COOKIE, VERIFIER_COOKIE, appOrigin, redirectUri, requestToken, saveTokens } from "@/lib/canva-auth";

// Canva sends the user back here after the REST sign-in. Swap the code for tokens, keep them in
// httpOnly cookies, then either continue to the Canva editor sign-in ("Connect Canva" does both)
// or return to the Canva page.

export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = (query: string) => NextResponse.redirect(`${appOrigin(request)}/connector/canva?${query}`);
  const fail = (message: string) => {
    const response = back(`error=${encodeURIComponent(message)}`);
    response.cookies.delete(CHAIN_COOKIE);
    return response;
  };

  const error = url.searchParams.get("error");
  if (error) {
    return fail(error === "access_denied" ? "Canva access wasn't allowed." : url.searchParams.get("error_description") || error);
  }

  const code = url.searchParams.get("code");
  if (!code) return fail("Canva didn't send an authorization code. Try connecting again.");

  const cookieStore = await cookies();
  const [state, verifier] = (cookieStore.get(VERIFIER_COOKIE)?.value || "").split(".");
  if (!verifier) return fail("The sign-in took too long or started on a different address. Try connecting again.");
  if (state !== url.searchParams.get("state")) return fail("Sign-in check failed. Try connecting again.");

  try {
    const token = await requestToken({
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri(request),
    });
    const continueToEditor = cookieStore.get(CHAIN_COOKIE)?.value === "editor";
    const response = continueToEditor
      ? NextResponse.redirect(`${appOrigin(request)}/api/auth/canva-mcp/login`)
      : back("connected=1");
    saveTokens(response.cookies, token);
    response.cookies.delete(VERIFIER_COOKIE);
    response.cookies.delete(CHAIN_COOKIE);
    return response;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Couldn't finish connecting to Canva.");
  }
}
