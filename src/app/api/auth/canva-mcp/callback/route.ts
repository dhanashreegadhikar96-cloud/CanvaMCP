import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { appOrigin } from "@/lib/canva-auth";
import { MCP_VERIFIER_COOKIE, mcpRedirectUri, requestMcpToken, saveMcpTokens } from "@/lib/canva-mcp-auth";

// Canva's MCP server sends the user back here after "Connect Canva editor".
export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = (query: string) => NextResponse.redirect(`${appOrigin()}/connector/canva?${query}`);
  const fail = (message: string) => back(`error=${encodeURIComponent(`Canva editor: ${message}`)}`);

  const error = url.searchParams.get("error");
  if (error) return fail(error === "access_denied" ? "access wasn't allowed." : url.searchParams.get("error_description") || error);

  const code = url.searchParams.get("code");
  if (!code) return fail("Canva didn't send an authorization code. Try connecting again.");

  const [state, verifier] = ((await cookies()).get(MCP_VERIFIER_COOKIE)?.value || "").split(".");
  if (!verifier) return fail("the sign-in took too long or started on a different address. Try again.");
  if (state !== url.searchParams.get("state")) return fail("sign-in check failed. Try again.");

  try {
    const token = await requestMcpToken({
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      redirect_uri: mcpRedirectUri(),
    });
    const response = back("connected=editor");
    saveMcpTokens(response.cookies, token);
    response.cookies.delete(MCP_VERIFIER_COOKIE);
    return response;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "couldn't finish connecting.");
  }
}
