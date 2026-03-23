import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { fromJsonArray } from "@/lib/db/json-array";
import { getProviderForFeature } from "@/lib/ai/provider";
import { buildResumePrompt } from "@/lib/ai/prompts/resume";
import type { AIProviderName } from "@/lib/ai/types";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });

  const body = await req.json();
  const { jobDescription, aiProvider } = body as {
    jobDescription?: string;
    aiProvider?: AIProviderName;
  };

  const profile = await prisma.userProfile.findFirst({
    where: { userId: session.user.id },
    include: {
      experiences: { orderBy: { sortOrder: "asc" } },
      education: { orderBy: { startDate: "desc" } },
      skills: true,
      certifications: true,
    },
  });

  if (!profile) {
    return new Response(
      JSON.stringify({ error: "Profile not found. Please complete your profile first." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const user = await prisma.user.findFirst({
    where: { id: session.user.id },
    select: { name: true, email: true },
  });

  const promptProfile = {
    name: user?.name || "Candidate",
    headline: profile.headline || undefined,
    summary: profile.summary || undefined,
    experiences: profile.experiences.map((exp) => ({
      title: exp.title,
      company: exp.company,
      location: exp.location || undefined,
      startDate: exp.startDate.toISOString().slice(0, 7),
      endDate: exp.endDate ? exp.endDate.toISOString().slice(0, 7) : undefined,
      current: exp.current,
      description: exp.description || undefined,
      bullets: fromJsonArray(exp.bullets as string),
    })),
    education: profile.education.map((edu) => ({
      institution: edu.institution,
      degree: edu.degree,
      field: edu.field || undefined,
      startDate: edu.startDate.toISOString().slice(0, 7),
      endDate: edu.endDate ? edu.endDate.toISOString().slice(0, 7) : undefined,
      gpa: edu.gpa?.toString(),
    })),
    skills: profile.skills.map((s) => ({
      name: s.name,
      level: s.level,
      category: s.category || undefined,
    })),
    certifications: profile.certifications.map((c) => ({
      name: c.name,
      issuer: c.issuer,
      issueDate: c.issueDate ? c.issueDate.toISOString().slice(0, 7) : undefined,
    })),
  };

  const prompt = buildResumePrompt(promptProfile, jobDescription || undefined);
  const provider = getProviderForFeature("resume", aiProvider);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const chunk of provider.streamText(prompt, {
          temperature: 0.7,
          maxTokens: 4000,
        })) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "AI generation failed";
        controller.enqueue(encoder.encode(JSON.stringify({ error: message })));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}
