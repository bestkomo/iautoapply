import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { getProviderForFeature } from "@/lib/ai/provider";
import { buildInterviewFeedbackPrompt } from "@/lib/ai/prompts/interview";
import type { AIProviderName } from "@/lib/ai/types";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { sessionId, aiProvider } = body as {
    sessionId: string;
    aiProvider?: AIProviderName;
  };

  if (!sessionId) {
    return Response.json(
      { error: "sessionId is required" },
      { status: 400 }
    );
  }

  const interviewSession = await prisma.interviewSession.findFirst({
    where: { id: sessionId, userId: session.user.id },
  });

  if (!interviewSession) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  let messages: Array<{ role: string; content: string }> = [];
  try {
    messages = JSON.parse(interviewSession.messages as string || "[]");
  } catch {
    messages = [];
  }

  if (!messages || messages.length < 2) {
    return Response.json(
      { error: "Not enough conversation to generate feedback" },
      { status: 400 }
    );
  }

  const prompt = buildInterviewFeedbackPrompt(messages);
  const provider = getProviderForFeature("interview", aiProvider);

  try {
    const response = await provider.generateText(prompt, {
      temperature: 0.5,
      maxTokens: 2000,
    });

    let feedback;
    try {
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      feedback = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(response.text);
    } catch {
      return Response.json(
        { error: "Failed to parse feedback response" },
        { status: 500 }
      );
    }

    await prisma.interviewSession.update({
      where: { id: sessionId },
      data: {
        feedback: JSON.stringify(feedback),
        score: feedback.overallScore ?? null,
        duration: Math.round(
          (Date.now() - new Date(interviewSession.createdAt).getTime()) / 1000
        ),
      },
    });

    return Response.json(feedback);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "AI generation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
