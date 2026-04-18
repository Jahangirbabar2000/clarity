import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ChatProvider, ChatRequest, ChatResponse, ChatMessage } from "./types";

let client: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (client) return client;
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY not set");
  client = new GoogleGenerativeAI(apiKey);
  return client;
}

export function toGeminiHistory(messages: ChatMessage[]) {
  const systemParts: string[] = [];
  const turns: { role: "user" | "model"; parts: { text: string }[] }[] = [];
  for (const m of messages) {
    if (m.role === "system") {
      systemParts.push(m.content);
    } else {
      turns.push({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      });
    }
  }
  return { systemInstruction: systemParts.join("\n\n"), turns };
}

export const geminiProvider: ChatProvider = {
  id: "google",
  isConfigured() {
    return Boolean(process.env.GOOGLE_API_KEY);
  },
  async chat(req: ChatRequest): Promise<ChatResponse> {
    const { systemInstruction, turns } = toGeminiHistory(req.messages);
    const model = getClient().getGenerativeModel({
      model: req.model,
      systemInstruction: systemInstruction || undefined,
      generationConfig: {
        maxOutputTokens: req.maxTokens,
        temperature: req.temperature,
      },
    });
    const result = await model.generateContent({ contents: turns });
    const text = result.response.text();
    const usage = result.response.usageMetadata;
    return {
      text,
      model: req.model,
      provider: "google",
      usage: {
        inputTokens: usage?.promptTokenCount,
        outputTokens: usage?.candidatesTokenCount,
      },
    };
  },
  async chatStream(req: ChatRequest, onDelta: (delta: string) => void): Promise<ChatResponse> {
    const { systemInstruction, turns } = toGeminiHistory(req.messages);
    const model = getClient().getGenerativeModel({
      model: req.model,
      systemInstruction: systemInstruction || undefined,
      generationConfig: {
        maxOutputTokens: req.maxTokens,
        temperature: req.temperature,
      },
    });
    const result = await model.generateContentStream({ contents: turns });
    let full = "";
    for await (const chunk of result.stream) {
      const delta = chunk.text();
      if (delta) {
        full += delta;
        onDelta(delta);
      }
    }
    return { text: full, model: req.model, provider: "google" };
  },
};
