import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { toGeminiHistory } from "./gemini";

describe("gemini toGeminiHistory", () => {
  it("extracts system instruction and maps user/assistant turns", () => {
    const { systemInstruction, turns } = toGeminiHistory([
      { role: "system", content: "sys" },
      { role: "user", content: "hi" },
      { role: "assistant", content: "yo" },
      { role: "user", content: "hi again" },
    ]);
    expect(systemInstruction).toBe("sys");
    expect(turns).toEqual([
      { role: "user", parts: [{ text: "hi" }] },
      { role: "model", parts: [{ text: "yo" }] },
      { role: "user", parts: [{ text: "hi again" }] },
    ]);
  });

  it("joins multiple system messages with two newlines", () => {
    const { systemInstruction } = toGeminiHistory([
      { role: "system", content: "a" },
      { role: "system", content: "b" },
      { role: "user", content: "q" },
    ]);
    expect(systemInstruction).toBe("a\n\nb");
  });

  it("renames 'assistant' role to 'model' (gemini's required name)", () => {
    const { turns } = toGeminiHistory([
      { role: "user", content: "q" },
      { role: "assistant", content: "a" },
    ]);
    expect(turns[1].role).toBe("model");
  });

  it("returns empty systemInstruction + turns when input is empty", () => {
    const { systemInstruction, turns } = toGeminiHistory([]);
    expect(systemInstruction).toBe("");
    expect(turns).toEqual([]);
  });
});

describe("geminiProvider.isConfigured", () => {
  const original = process.env.GOOGLE_API_KEY;
  afterEach(() => {
    if (original === undefined) delete process.env.GOOGLE_API_KEY;
    else process.env.GOOGLE_API_KEY = original;
  });

  it("returns true when key is set", async () => {
    process.env.GOOGLE_API_KEY = "gk-test";
    const { geminiProvider } = await import("./gemini");
    expect(geminiProvider.isConfigured()).toBe(true);
  });

  it("returns false when key is empty", async () => {
    process.env.GOOGLE_API_KEY = "";
    const { geminiProvider } = await import("./gemini");
    expect(geminiProvider.isConfigured()).toBe(false);
  });
});

describe("geminiProvider.chat (mocked SDK)", () => {
  const generateContent = vi.fn();
  const generateContentStream = vi.fn();
  const getGenerativeModel = vi.fn();

  beforeEach(() => {
    generateContent.mockReset();
    generateContentStream.mockReset();
    getGenerativeModel.mockReset();
    getGenerativeModel.mockReturnValue({
      generateContent,
      generateContentStream,
    });
    process.env.GOOGLE_API_KEY = "gk-test";
    vi.resetModules();
    vi.doMock("@google/generative-ai", () => ({
      GoogleGenerativeAI: class {
        getGenerativeModel = getGenerativeModel;
      },
    }));
  });

  afterEach(() => {
    vi.doUnmock("@google/generative-ai");
    vi.resetModules();
  });

  it("passes systemInstruction + turns and extracts text + usage", async () => {
    generateContent.mockResolvedValue({
      response: {
        text: () => "hi",
        usageMetadata: { promptTokenCount: 8, candidatesTokenCount: 2 },
      },
    });
    const { geminiProvider } = await import("./gemini");
    const resp = await geminiProvider.chat({
      model: "gemini-2.5-pro",
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "q" },
      ],
      maxTokens: 200,
      temperature: 0.1,
    });
    expect(resp.text).toBe("hi");
    expect(resp.usage).toEqual({ inputTokens: 8, outputTokens: 2 });

    const modelCfg = getGenerativeModel.mock.calls[0][0];
    expect(modelCfg.model).toBe("gemini-2.5-pro");
    expect(modelCfg.systemInstruction).toBe("sys");
    expect(modelCfg.generationConfig).toEqual({
      maxOutputTokens: 200,
      temperature: 0.1,
    });

    const callArg = generateContent.mock.calls[0][0];
    expect(callArg.contents).toEqual([
      { role: "user", parts: [{ text: "q" }] },
    ]);
  });

  it("streams chunks via generateContentStream", async () => {
    async function* iter() {
      yield { text: () => "he" };
      yield { text: () => "" };
      yield { text: () => "llo" };
    }
    generateContentStream.mockResolvedValue({ stream: iter() });
    const { geminiProvider } = await import("./gemini");
    const deltas: string[] = [];
    const resp = await geminiProvider.chatStream(
      {
        model: "gemini-2.5-pro",
        messages: [{ role: "user", content: "q" }],
      },
      (d) => deltas.push(d),
    );
    expect(deltas).toEqual(["he", "llo"]);
    expect(resp.text).toBe("hello");
  });
});
