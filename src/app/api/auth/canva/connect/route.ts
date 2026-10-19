import { NextResponse } from "next/server";
import { appOrigin } from "@/lib/canva-auth";

// Old combined "Connect Canva" link. The two connections are separate again (Canva REST API and
// Canva MCP each have their own Connect), so this now just starts the REST API sign-in.
export async function GET(request: Request) {
  return NextResponse.redirect(`${appOrigin(request)}/api/auth/canva/login`);
}
