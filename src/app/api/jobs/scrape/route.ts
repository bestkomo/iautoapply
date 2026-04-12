export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { getScraperManager } from "@/lib/scrapers/scraper-manager";
import { prisma } from "@/lib/db/prisma";
import { fromJsonArray } from "@/lib/db/json-array";

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

    // If no query provided, use the user's job preferences
    if (!query) {
      const prefs = await prisma.jobPreference.findFirst({
        where: { userId: session.user.id },
      });

      if (prefs) {
        const titles = fromJsonArray(prefs.desiredTitles as string);
        const locations = fromJsonArray(prefs.desiredLocations as string);

        if (titles.length > 0) {
          // Use the first 2 desired titles as search queries
          query = titles.slice(0, 2).join(" OR ");
        }
        if (!location && locations.length > 0) {
          location = locations[0];
        }
      }

      // Final fallback
      if (!query) {
        query = "customer service";
      }
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
