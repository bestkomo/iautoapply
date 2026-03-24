export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { fromJsonArray } from "@/lib/db/json-array";
import { getProviderForFeature } from "@/lib/ai/provider";
import { buildCoverLetterPrompt } from "@/lib/ai/prompts/cover-letter";
import type { AIProviderName } from "@/lib/ai/types";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });

  const body = await req.json();
  const { jobTitle, company, jobDescription, tone, aiProvider } = body;

  if (!jobTitle || !company || !jobDescription) {
    return new Response(
      JSON.stringify({ error: "jobTitle, company, and jobDescription are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Fetch user profile for personalization
  const profile = await prisma.userProfile.findFirst({
    where: { userId: session.user.id },
    include: {
      experiences: { orderBy: { startDate: "desc" }, take: 3 },
      skills: true,
    },
  });

  const user = await prisma.user.findFirst({
    where: { id: session.user.id },
    select: { name: true },
  });

  const candidateName = user?.name || "Candidate";

  const candidateSummary = profile?.summary || "Experienced professional";

  const relevantExperience = profile?.experiences
    ?.map((exp) => {
      const bullets = fromJsonArray(exp.bullets as string);
      return `${exp.title} at ${exp.company}${bullets.length ? ": " + bullets.slice(0, 2).join("; ") : ""}`;
    })
    .join("\n") || "Various professional roles";

  const prompt = buildCoverLetterPrompt({
    candidateName,
    candidateSummary,
    relevantExperience,
    jobTitle,
    company,
    jobDescription,
    tone: tone || "professional",
  });

  const provider = getProviderForFeature(
    "coverLetter",
    aiProvider as AIProviderName | undefined
  );

  // Stream the response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const iterable = provider.streamText(prompt, {
          temperature: 0.7,
          maxTokens: 1024,
        });

        for await (const chunk of iterable) {
          controller.enqueue(encoder.encode(chunk));
        }

        controller.close();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "AI generation failed";
        controller.enqueue(encoder.encode(`\n\n[Error: ${message}]`));
        controller.close();
      }
    },
  });

  // Log AI usage
  prisma.aIUsageLog
    .create({
      data: {
        userId: session.user.id,
        provider: provider.name,
        model: "default",
        feature: "coverLetter",
        tokens: 0, // Updated after streaming completes in a real implementation
      },
    })
    .catch(() => {}); // Fire-and-forget

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
    },
  });
}
