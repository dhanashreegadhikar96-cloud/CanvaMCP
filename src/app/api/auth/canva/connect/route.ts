import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CHAIN_COOKIE, appOrigin, isConnected } from "@/lib/canva-auth";
import { isMcpConnected } from "@/lib/canva-mcp-auth";

// One "Connect Canva" for both of Canva's sign-ins, which issue separate tokens:
//   1. the REST API sign-in (your Developer Portal app): search, folders, export
//   2. the Canva editor sign-in (Canva's MCP server): editing inside designs
// Runs whichever is still missing, one after the other; the REST callback continues to the editor
// sign-in when the chain cookie is set.

export async function GET(request: Request) {
  const origin = appOrigin(request);
  // Locally, continue on 127.0.0.1 if the browser used localhost, so the chain cookie is on the
  // host the sign-in comes back to
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (host && host !== new URL(origin).host) {
    return NextResponse.redirect(`${origin}/api/auth/canva/connect`);
  }
  const cookieStore = await cookies();
  const needRest = !isConnected(cookieStore);
  const needEditor = !isMcpConnected(cookieStore);

  if (!needRest && !needEditor) return NextResponse.redirect(`${origin}/connector/canva`);
  if (!needRest) return NextResponse.redirect(`${origin}/api/auth/canva-mcp/login`);

  const response = NextResponse.redirect(`${origin}/api/auth/canva/login`);
  if (needEditor) {
    response.cookies.set(CHAIN_COOKIE, "editor", {
      httpOnly: true,
      secure: origin.startsWith("https://"),
      sameSite: "lax",
      maxAge: 15 * 60,
      path: "/",
    });
  }
  return response;
}
