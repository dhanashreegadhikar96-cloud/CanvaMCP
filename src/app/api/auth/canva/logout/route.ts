import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { REFRESH_COOKIE, clearTokens, revokeToken } from "@/lib/canva-auth";
import { MCP_TOKEN_COOKIES } from "@/lib/canva-mcp-auth";

// "Disconnect": revoke the Canva REST grant (best effort) and forget both Canva sign-ins (REST and editor).
export async function POST() {
  const refresh = (await cookies()).get(REFRESH_COOKIE)?.value;
  if (refresh) await revokeToken(refresh);
  const response = NextResponse.json({ ok: true });
  clearTokens(response);
  for (const name of MCP_TOKEN_COOKIES) response.cookies.delete(name);
  return response;
}
