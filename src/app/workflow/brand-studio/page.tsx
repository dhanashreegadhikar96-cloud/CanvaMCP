import { cookies } from "next/headers";
import { isConnected } from "@/lib/canva-auth";
import { isMcpConnected } from "@/lib/canva-mcp-auth";
import { DEASRA } from "@/lib/brand/deasra";
import BrandStudio from "./BrandStudio";
import "./studio.css";

// Brand-aligned wireframes and images (Use Case 2): brief → brand-aligned plan and preview → built in Canva.
// A standalone tool with its own look (not the NSOffice shell).
export const dynamic = "force-dynamic";

export const metadata = { title: "deAsra Brand Studio" };

export default async function BrandStudioPage() {
  const cookieStore = await cookies();
  const rest = isConnected(cookieStore);
  const mcp = isMcpConnected(cookieStore);
  return (
    <div className="studio-app">
      <header className="studio-bar">
        <a className="studio-brand" href="/workflow/brand-studio">
          <span className="studio-brand-mark">dA</span>
          <span>deAsra <b>Brand Studio</b></span>
        </a>
        {mcp ? (
          <span className="studio-conn is-on" title="Canva MCP connected">
            <i className="fa-solid fa-circle"></i> Canva connected
          </span>
        ) : (
          // The studio needs only Canva MCP; locally any Canva account can sign in to it (see docs/BRAND_STUDIO.md)
          <a className="studio-conn studio-conn--link" href="/api/auth/canva-mcp/login?return=%2Fworkflow%2Fbrand-studio">
            <i className="fa-solid fa-circle"></i> Connect Canva
          </a>
        )}
      </header>
      <BrandStudio brand={DEASRA} connected={rest} editorConnected={mcp} />
    </div>
  );
}
