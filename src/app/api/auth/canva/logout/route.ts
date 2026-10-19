import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { REFRESH_COOKIE, clearTokens, revokeToken } from "@/lib/canva-auth";
import { MCP_TOKEN_COOKIES } from "@/lib/canva-mcp-auth";

// Disconnect: ?which=rest (Canva REST API), ?which=mcp (Canva MCP), or both when left out.
// The REST grant is revoked at Canva (best effort); MCP tokens are forgotten.
export async function POST(request: Request) {
  const which = new URL(request.url).searchParams.get("which");
  const response = NextResponse.json({ ok: true });
  if (which !== "mcp") {
    const refresh = (await cookies()).get(REFRESH_COOKIE)?.value;
    if (refresh) await revokeToken(refresh);
    clearTokens(response);
  }
  if (which !== "rest") {
    for (const name of MCP_TOKEN_COOKIES) response.cookies.delete(name);
  }
  return response;
}
