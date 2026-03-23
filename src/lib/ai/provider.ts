import type { AIProvider, AIProviderName } from "./types";
import { claudeProvider } from "./claude";
import { openaiProvider } from "./openai";

const providers: Record<AIProviderName, AIProvider> = {
  claude: claudeProvider,
  openai: openaiProvider,
};

export function getAIProvider(name: AIProviderName = "claude"): AIProvider {
  const provider = providers[name];
  if (!provider) throw new Error(`Unknown AI provider: ${name}`);
  return provider;
}

export const defaultProviders: Record<string, AIProviderName> = {
  resume: "claude",
  coverLetter: "claude",
  scanner: "openai",
  translate: "openai",
  interview: "claude",
  interviewBuddy: "openai",
  networking: "claude",
};

export function getProviderForFeature(feature: string, override?: AIProviderName): AIProvider {
  const providerName = override || defaultProviders[feature] || "claude";
  return getAIProvider(providerName);
}
