import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ["@prisma/client", "bcryptjs", "pdf-parse", "unpdf", "mammoth", "puppeteer", "playwright", "playwright-core", "@anthropic-ai/sdk", "openai", "pdfkit"],
};

export default nextConfig;
