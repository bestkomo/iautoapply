import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  verification: {
    google: "HxWeD6UZLZd8sK9H9odLXxCdYJlN5xAG8PZjMEuxrl4",
  },
  title: "iAutoApply - Auto Apply to Jobs with AI | 50 Applications Per Day",
  description:
    "Stop applying to jobs manually. iAutoApply uses AI to automatically apply to 50+ jobs per day on Greenhouse, Lever & Workday while you sleep. Start free.",
  keywords: [
    "auto apply jobs",
    "automatic job application",
    "AI job apply",
    "auto apply to jobs",
    "job application bot",
    "apply to jobs automatically",
    "bulk job application",
    "AI job search",
    "automated job applications",
    "auto apply greenhouse",
    "auto apply workday",
    "auto apply lever",
  ],
  openGraph: {
    title: "iAutoApply - Auto Apply to 50 Jobs Per Day with AI",
    description:
      "Stop applying to jobs manually. AI applies to 50+ jobs daily on Greenhouse, Lever & Workday while you sleep.",
    url: "https://iautoaply.com",
    siteName: "iAutoApply",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "iAutoApply - Auto Apply to 50 Jobs Per Day with AI",
    description:
      "Stop applying to jobs manually. AI applies to 50+ jobs daily while you sleep.",
  },
  metadataBase: new URL("https://iautoaply.com"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased min-h-screen bg-background text-foreground`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
