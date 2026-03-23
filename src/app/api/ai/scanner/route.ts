import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { getProviderForFeature } from "@/lib/ai/provider";
import { buildScannerPrompt } from "@/lib/ai/prompts/scanner";
import type { AIProviderName } from "@/lib/ai/types";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { resumeText, jobDescription, aiProvider } = body as {
    resumeText: string;
    jobDescription?: string;
    aiProvider?: AIProviderName;
  };

  if (!resumeText) {
    return NextResponse.json(
      { error: "resumeText is required" },
      { status: 400 }
    );
  }

  const provider = getProviderForFeature("scanner", aiProvider);
  const prompt = buildScannerPrompt(resumeText, jobDescription || undefined);

  const result = await provider.generateText(prompt, {
    temperature: 0.3,
    maxTokens: 3000,
  });

  let analysis;
  try {
    analysis = JSON.parse(result.text);
  } catch {
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      analysis = JSON.parse(jsonMatch[0]);
    } else {
      return NextResponse.json(
        { error: "Failed to parse scanner results" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(analysis);
}
