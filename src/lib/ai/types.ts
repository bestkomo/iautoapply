export type AIProviderName = "claude" | "openai";

export interface AIOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface AIResponse {
  text: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  model: string;
  provider: AIProviderName;
}

export interface AIProvider {
  name: AIProviderName;
  generateText(prompt: string, options?: AIOptions): Promise<AIResponse>;
  streamText(prompt: string, options?: AIOptions): AsyncIterable<string>;
}
