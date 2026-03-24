import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ["@prisma/client", "bcryptjs", "pdf-parse", "mammoth", "puppeteer", "playwright", "playwright-core"],
};

export default nextConfig;
