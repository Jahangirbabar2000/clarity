/**
 * Provider-agnostic chat interface used by the Clarity multi-LLM router.
 *
 * All three vendor adapters (OpenAI, Anthropic, Google) implement {@link ChatProvider}.
 * This keeps the rest of the app free of vendor-specific SDK types so the router
 * can swap models per task without touching agent code.
 */

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface ChatResponse {
  text: string;
  model: string;
  provider: ProviderId;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export type ProviderId = "openai" | "anthropic" | "google";

export interface ChatProvider {
  id: ProviderId;
  isConfigured(): boolean;
  chat(req: ChatRequest): Promise<ChatResponse>;
  chatStream(req: ChatRequest, onDelta: (delta: string) => void): Promise<ChatResponse>;
}
