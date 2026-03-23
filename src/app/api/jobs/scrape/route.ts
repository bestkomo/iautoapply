import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { getScraperManager } from "@/lib/scrapers/scraper-manager";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const queryParam = searchParams.get("query") || "";
    const locationParam = searchParams.get("location") || "";

    // Also accept JSON body
    let query = queryParam;
    let location = locationParam;

    try {
      const body = await req.json();
      if (body.query) query = body.query;
      if (body.location) location = body.location;
    } catch {
      // No JSON body, use query params
    }

    // Default query if none provided
    if (!query) {
      query = "software engineer";
    }

    console.log(
      `[/api/jobs/scrape] User ${session.user.id} triggered scrape: query="${query}" location="${location}"`
    );

    const manager = getScraperManager();
    const result = await manager.scrapeAll(query, location || undefined);

    return NextResponse.json({
      scraped: result.added,
      duplicates: result.duplicates,
      sources: result.sources,
      errors: result.sourceErrors,
    });
  } catch (error) {
    console.error("[/api/jobs/scrape] Error:", error);
    return NextResponse.json(
      { error: "Failed to scrape jobs" },
      { status: 500 }
    );
  }
}
