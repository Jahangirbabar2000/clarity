import OpenAI from "openai";

let cached: OpenAI | null = null;

export function openai(): OpenAI {
  if (cached) return cached;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  cached = new OpenAI({ apiKey });
  return cached;
}

export const OPENAI_MODEL = "gpt-4o";

export function isAIConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function stripJsonFences(s: string): string {
  return s
    .trim()
    .replace(/^```(?:json)?\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();
}
