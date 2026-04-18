import Anthropic from "@anthropic-ai/sdk";
import type { ChatProvider, ChatRequest, ChatResponse, ChatMessage } from "./types";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  client = new Anthropic({ apiKey });
  return client;
}

export function splitSystem(messages: ChatMessage[]) {
  const systemParts: string[] = [];
  const rest: ChatMessage[] = [];
  for (const m of messages) {
    if (m.role === "system") systemParts.push(m.content);
    else rest.push(m);
  }
  return { system: systemParts.join("\n\n"), rest };
}

export const anthropicProvider: ChatProvider = {
  id: "anthropic",
  isConfigured() {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  },
  async chat(req: ChatRequest): Promise<ChatResponse> {
    const { system, rest } = splitSystem(req.messages);
    const resp = await getClient().messages.create({
      model: req.model,
      max_tokens: req.maxTokens ?? 4000,
      temperature: req.temperature,
      system: system || undefined,
      messages: rest.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
    });
    const text = resp.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text)
      .join("");
    return {
      text,
      model: req.model,
      provider: "anthropic",
      usage: {
        inputTokens: resp.usage.input_tokens,
        outputTokens: resp.usage.output_tokens,
      },
    };
  },
  async chatStream(req: ChatRequest, onDelta: (delta: string) => void): Promise<ChatResponse> {
    const { system, rest } = splitSystem(req.messages);
    let full = "";
    const stream = await getClient().messages.stream({
      model: req.model,
      max_tokens: req.maxTokens ?? 4000,
      temperature: req.temperature,
      system: system || undefined,
      messages: rest.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
    });
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        const delta = event.delta.text;
        full += delta;
        onDelta(delta);
      }
    }
    return { text: full, model: req.model, provider: "anthropic" };
  },
};
