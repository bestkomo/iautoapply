export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { getProviderForFeature } from "@/lib/ai/provider";
import { buildTranslatePrompt } from "@/lib/ai/prompts/translate";
import type { AIProviderName } from "@/lib/ai/types";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { resumeId, targetLanguage, aiProvider } = body as {
    resumeId: string;
    targetLanguage: string;
    aiProvider?: AIProviderName;
  };

  if (!resumeId || !targetLanguage) {
    return NextResponse.json(
      { error: "resumeId and targetLanguage are required" },
      { status: 400 }
    );
  }

  const resume = await prisma.resume.findFirst({ where: { id: resumeId } });
  if (!resume)
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  if (resume.userId !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const provider = getProviderForFeature("translate", aiProvider);
  const prompt = buildTranslatePrompt(
    JSON.stringify(resume.content),
    targetLanguage
  );

  const result = await provider.generateText(prompt, {
    temperature: 0.3,
    maxTokens: 4000,
  });

  let translatedContent;
  try {
    translatedContent = JSON.parse(result.text);
  } catch {
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      translatedContent = JSON.parse(jsonMatch[0]);
    } else {
      return NextResponse.json(
        { error: "Failed to parse translated content" },
        { status: 500 }
      );
    }
  }

  const translated = await prisma.resume.create({
    data: {
      userId: session.user.id,
      title: `${resume.title} (${targetLanguage.toUpperCase()})`,
      templateId: resume.templateId,
      content: translatedContent,
      language: targetLanguage,
      tailoredFor: resume.tailoredFor,
    },
  });

  return NextResponse.json(translated, { status: 201 });
}
