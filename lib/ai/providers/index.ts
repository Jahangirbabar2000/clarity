import { openaiProvider } from "./openai";
import { anthropicProvider } from "./anthropic";
import { geminiProvider } from "./gemini";
import type { ChatProvider, ProviderId } from "./types";

export const providers: Record<ProviderId, ChatProvider> = {
  openai: openaiProvider,
  anthropic: anthropicProvider,
  google: geminiProvider,
};

export function getProvider(id: ProviderId): ChatProvider {
  return providers[id];
}

export function configuredProviderIds(): ProviderId[] {
  return (Object.keys(providers) as ProviderId[]).filter((id) => providers[id].isConfigured());
}

export function hasAnyProvider(): boolean {
  return configuredProviderIds().length > 0;
}

export type { ChatMessage, ChatRequest, ChatResponse, ChatProvider, ProviderId } from "./types";
