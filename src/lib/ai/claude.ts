import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, AIOptions, AIResponse } from "./types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const claudeProvider: AIProvider = {
  name: "claude",

  async generateText(prompt: string, options: AIOptions = {}): Promise<AIResponse> {
    const response = await client.messages.create({
      model: options.model || "claude-sonnet-4-20250514",
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
      system: options.systemPrompt || "",
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    return {
      text,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      model: response.model,
      provider: "claude",
    };
  },

  async *streamText(prompt: string, options: AIOptions = {}): AsyncIterable<string> {
    const stream = client.messages.stream({
      model: options.model || "claude-sonnet-4-20250514",
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
      system: options.systemPrompt || "",
      messages: [{ role: "user", content: prompt }],
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text;
      }
    }
  },
};
