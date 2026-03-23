import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { getProviderForFeature } from "@/lib/ai/provider";
import { buildInterviewSystemPrompt } from "@/lib/ai/prompts/interview";
import type { AIProviderName } from "@/lib/ai/types";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { jobTitle, company, type, aiProvider } = body as {
    jobTitle: string;
    company?: string;
    type: "behavioral" | "technical" | "case";
    aiProvider?: AIProviderName;
  };

  if (!jobTitle || !type) {
    return Response.json(
      { error: "jobTitle and type are required" },
      { status: 400 }
    );
  }

  const systemPrompt = buildInterviewSystemPrompt({ jobTitle, company, type });
  const provider = getProviderForFeature("interview", aiProvider);

  const interviewSession = await prisma.interviewSession.create({
    data: {
      userId: session.user.id,
      jobTitle,
      company: company || null,
      type,
      messages: "[]",
    },
  });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let fullResponse = "";

      try {
        for await (const chunk of provider.streamText(
          "Start the interview now. Introduce yourself briefly and ask the first question.",
          {
            systemPrompt,
            temperature: 0.8,
            maxTokens: 1000,
          }
        )) {
          fullResponse += chunk;
          controller.enqueue(encoder.encode(chunk));
        }

        await prisma.interviewSession.update({
          where: { id: interviewSession.id },
          data: {
            messages: JSON.stringify([{ role: "assistant", content: fullResponse }]),
          },
        });

        controller.enqueue(
          encoder.encode(
            `\n\n__SESSION_ID__:${interviewSession.id}`
          )
        );
        controller.close();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "AI generation failed";
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

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { sessionId, answer, aiProvider } = body as {
    sessionId: string;
    answer: string;
    aiProvider?: AIProviderName;
  };

  if (!sessionId || !answer) {
    return Response.json(
      { error: "sessionId and answer are required" },
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
  messages.push({ role: "user", content: answer });

  const systemPrompt = buildInterviewSystemPrompt({
    jobTitle: interviewSession.jobTitle,
    company: interviewSession.company || undefined,
    type: interviewSession.type as "behavioral" | "technical" | "case",
  });

  const conversationContext = messages
    .map(
      (m) =>
        `${m.role === "assistant" ? "INTERVIEWER" : "CANDIDATE"}: ${m.content}`
    )
    .join("\n\n");

  const provider = getProviderForFeature("interview", aiProvider);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let fullResponse = "";

      try {
        for await (const chunk of provider.streamText(
          `${conversationContext}\n\nProvide brief feedback on the candidate's last answer and ask the next question. If you've asked 5-7 questions already, wrap up the interview instead.`,
          {
            systemPrompt,
            temperature: 0.8,
            maxTokens: 1000,
          }
        )) {
          fullResponse += chunk;
          controller.enqueue(encoder.encode(chunk));
        }

        messages.push({ role: "assistant", content: fullResponse });

        await prisma.interviewSession.update({
          where: { id: sessionId },
          data: { messages: JSON.stringify(messages) },
        });

        controller.close();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "AI generation failed";
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
