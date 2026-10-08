import { NextResponse } from "next/server";
import { appOrigin, redirectUri } from "@/lib/canva-auth";
import { PORTAL_MCP_URL, MCP_URL, portalSetting, usePortalApp } from "@/lib/canva-mcp-auth";

// Setup check for the Canva connection: which routes this deployment will use.
// Yes/no values and public addresses only, never client IDs, secrets or tokens.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const portal = usePortalApp();
  return NextResponse.json({
    address: appOrigin(request),
    canvaCallback: redirectUri(request),
    clientIdSet: Boolean(process.env.CANVA_CLIENT_ID),
    clientSecretSet: Boolean(process.env.CANVA_CLIENT_SECRET),
    portalSettingOn: portalSetting(), // CANVA_MCP_USE_PORTAL_APP
    editorRoute: portal
      ? `Developer Portal app: the Canva sign-in also covers ${PORTAL_MCP_URL}`
      : `Self-registered editor sign-in on ${MCP_URL} (works on 127.0.0.1 only)`,
    geminiKeySet: Boolean(process.env.GEMINI_API_KEY),
  });
}
