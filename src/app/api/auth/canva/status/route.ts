import { NextResponse } from "next/server";
import { appOrigin, redirectUri } from "@/lib/canva-auth";
import { PORTAL_MCP_URL, MCP_URL, mcpRedirectUri, portalSetting, usePortalApp } from "@/lib/canva-mcp-auth";

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
    restSignIn: "Canva REST API: your Developer Portal app (owner/collaborators only until released)",
    mcpSignIn: portal
      ? `Canva MCP: separate sign-in with your Developer Portal app, tools at ${PORTAL_MCP_URL} (owner/collaborators only until released)`
      : `Canva MCP: separate self-registered sign-in on ${MCP_URL} (any Canva account; 127.0.0.1 only)`,
    mcpCallback: mcpRedirectUri(request),
    geminiKeySet: Boolean(process.env.GEMINI_API_KEY),
  });
}
