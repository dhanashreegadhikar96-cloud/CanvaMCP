import { NextResponse } from "next/server";
import crypto from "crypto";
import { appOrigin } from "@/lib/canva-auth";
import { MCP_VERIFIER_COOKIE, mcpAuthorizeUrl, mcpClientId } from "@/lib/canva-mcp-auth";

// Starts "Connect Canva editor": Canva's MCP server sign-in (PKCE).
export async function GET(request: Request) {
  const origin = appOrigin();
  // Keep the verifier cookie on the host Canva returns to (127.0.0.1 locally)
  const host = request.headers.get("host");
  if (host && host !== new URL(origin).host) {
    return NextResponse.redirect(`${origin}/api/auth/canva-mcp/login`);
  }

  let clientId: string;
  try {
    clientId = await mcpClientId();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't register with Canva's MCP server.";
    return NextResponse.redirect(`${origin}/connector/canva?error=${encodeURIComponent(message)}`);
  }

  const verifier = crypto.randomBytes(48).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const state = crypto.randomBytes(16).toString("base64url");

  const response = NextResponse.redirect(mcpAuthorizeUrl(clientId, challenge, state));
  response.cookies.set(MCP_VERIFIER_COOKIE, `${state}.${verifier}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/",
  });
  return response;
}
