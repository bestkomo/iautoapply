import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  serverExternalPackages: ["@prisma/client", "bcryptjs", "pdf-parse", "mammoth", "puppeteer", "playwright", "playwright-core", "better-sqlite3", "@prisma/adapter-better-sqlite3"],
};

export default nextConfig;
