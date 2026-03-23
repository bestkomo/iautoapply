import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { getProviderForFeature } from "@/lib/ai/provider";
import {
  buildNetworkingPrompt,
  type NetworkingMessageType,
} from "@/lib/ai/prompts/networking";
import type { AIProviderName } from "@/lib/ai/types";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { type, recipientName, recipientTitle, company, context, aiProvider } =
    body as {
      type: NetworkingMessageType;
      recipientName?: string;
      recipientTitle?: string;
      company?: string;
      context?: string;
      aiProvider?: AIProviderName;
    };

  if (!type) {
    return Response.json({ error: "type is required" }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { id: session.user.id },
    include: {
      profile: {
        select: { headline: true },
      },
    },
  });

  const prompt = buildNetworkingPrompt({
    type,
    senderName: user?.name || "Job Seeker",
    senderTitle: user?.profile?.headline || "Professional",
    recipientName,
    recipientTitle,
    company,
    context,
  });

  const provider = getProviderForFeature("networking", aiProvider);

  try {
    const response = await provider.generateText(prompt, {
      temperature: 0.7,
      maxTokens: 1000,
    });

    return Response.json({
      text: response.text,
      model: response.model,
      provider: response.provider,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "AI generation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
