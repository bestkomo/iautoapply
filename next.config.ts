import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  serverExternalPackages: ["@prisma/client", "bcryptjs", "pdf-parse", "mammoth", "puppeteer", "playwright", "playwright-core"],
};

export default nextConfig;
