import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Hide Next's dev-mode "N" badge: it sits over the sidebar's user block in the NSOffice shell
  devIndicators: false,
};

export default nextConfig;
