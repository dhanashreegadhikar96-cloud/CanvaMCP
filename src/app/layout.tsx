import type { Metadata } from "next";
import Script from "next/script";
import { nsoffice } from "@/nsoffice/config";
import KitScripts from "@/nsoffice/KitScripts";

export const metadata: Metadata = {
  title: nsoffice.title,
  description: "Create, find and export Canva designs from NSOffice through Canva's MCP server",
};

const KIT_CSS = "/nsoffice-ui/static/css";

// The <head> mirrors nsoffice_ui/templates/nsoffice/base.html. Pages render the shell with <Shell>.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {/* Bootstrap 5 & FontAwesome icons */}
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />

        {/* NSOffice UI kit */}
        <link rel="stylesheet" href={`${KIT_CSS}/tokens.css`} />
        <link rel="stylesheet" href={`${KIT_CSS}/shell.css`} />
        <link rel="stylesheet" href={`${KIT_CSS}/components.css`} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <Script src="https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js" strategy="beforeInteractive" />
      </head>
      <body>
        {children}
        <KitScripts />
      </body>
    </html>
  );
}
