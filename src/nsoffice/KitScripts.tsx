"use client";

// Loads the kit's shell.js, catalog.js and composer.js, and draws Lucide icons after React has hydrated.
// (shell.js draws them on DOMContentLoaded, which is too early for React: swapping <i> for <svg>
// before hydration causes a mismatch.)
import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

declare global {
  interface Window {
    lucide?: { createIcons: () => void };
  }
}

const KIT_JS = "/nsoffice-ui/static/js";

export default function KitScripts() {
  const pathname = usePathname();

  useEffect(() => {
    window.lucide?.createIcons();
  }, [pathname]);

  return (
    <>
      <Script src={`${KIT_JS}/shell.js`} strategy="afterInteractive" />
      <Script src={`${KIT_JS}/catalog.js`} strategy="afterInteractive" />
      <Script src={`${KIT_JS}/composer.js`} strategy="afterInteractive" />
    </>
  );
}
