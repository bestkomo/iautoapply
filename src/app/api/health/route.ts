export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

export async function GET() {
  const checks: Record<string, string> = {};

  // Check DATABASE_URL
  checks.DATABASE_URL = process.env.DATABASE_URL ? "set" : "MISSING";

  // Check Prisma client import
  try {
    const { prisma } = await import("@/lib/db/prisma");
    checks.prismaImport = "ok";

    // Try a simple query
    const count = await prisma.user.count();
    checks.dbQuery = `ok (${count} users)`;
  } catch (e: any) {
    checks.prismaError = e.message;
    checks.prismaStack = e.stack?.split("\n").slice(0, 3).join(" | ");
  }

  const allOk = !checks.prismaError && checks.DATABASE_URL === "set";
  return NextResponse.json(
    { status: allOk ? "healthy" : "unhealthy", checks },
    { status: allOk ? 200 : 500 }
  );
}
