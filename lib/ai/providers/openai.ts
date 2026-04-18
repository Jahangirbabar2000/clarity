import OpenAI from "openai";
import type { ChatProvider, ChatRequest, ChatResponse } from "./types";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (client) return client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  client = new OpenAI({ apiKey });
  return client;
}

export const openaiProvider: ChatProvider = {
  id: "openai",
  isConfigured() {
    return Boolean(process.env.OPENAI_API_KEY);
  },
  async chat(req: ChatRequest): Promise<ChatResponse> {
    const resp = await getClient().chat.completions.create({
      model: req.model,
      max_tokens: req.maxTokens,
      temperature: req.temperature,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    });
    return {
      text: resp.choices[0]?.message?.content ?? "",
      model: req.model,
      provider: "openai",
      usage: {
        inputTokens: resp.usage?.prompt_tokens,
        outputTokens: resp.usage?.completion_tokens,
      },
    };
  },
  async chatStream(req: ChatRequest, onDelta: (delta: string) => void): Promise<ChatResponse> {
    let full = "";
    const stream = await getClient().chat.completions.create({
      model: req.model,
      max_tokens: req.maxTokens,
      temperature: req.temperature,
      stream: true,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        full += delta;
        onDelta(delta);
      }
    }
    return { text: full, model: req.model, provider: "openai" };
  },
};
