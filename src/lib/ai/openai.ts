import OpenAI from "openai";
import type { AIProvider, AIOptions, AIResponse } from "./types";

let _client: OpenAI | null = null;
function getClient() {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "dummy" });
  return _client;
}

export const openaiProvider: AIProvider = {
  name: "openai",

  async generateText(prompt: string, options: AIOptions = {}): Promise<AIResponse> {
    const response = await getClient().chat.completions.create({
      model: options.model || "gpt-4o",
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
      messages: [
        ...(options.systemPrompt ? [{ role: "system" as const, content: options.systemPrompt }] : []),
        { role: "user" as const, content: prompt },
      ],
    });

    return {
      text: response.choices[0]?.message?.content || "",
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
      },
      model: response.model,
      provider: "openai",
    };
  },

  async *streamText(prompt: string, options: AIOptions = {}): AsyncIterable<string> {
    const stream = await getClient().chat.completions.create({
      model: options.model || "gpt-4o",
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
      messages: [
        ...(options.systemPrompt ? [{ role: "system" as const, content: options.systemPrompt }] : []),
        { role: "user" as const, content: prompt },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) yield text;
    }
  },
};
