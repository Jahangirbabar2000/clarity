import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("openaiProvider.isConfigured", () => {
  const original = process.env.OPENAI_API_KEY;
  afterEach(() => {
    if (original === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = original;
  });

  it("returns true when key is set", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const { openaiProvider } = await import("./openai");
    expect(openaiProvider.isConfigured()).toBe(true);
    expect(openaiProvider.id).toBe("openai");
  });

  it("returns false when key is absent", async () => {
    delete process.env.OPENAI_API_KEY;
    const { openaiProvider } = await import("./openai");
    expect(openaiProvider.isConfigured()).toBe(false);
  });
});

describe("openaiProvider.chat (mocked SDK)", () => {
  const createMock = vi.fn();

  beforeEach(() => {
    createMock.mockReset();
    process.env.OPENAI_API_KEY = "sk-test";
    vi.resetModules();
    vi.doMock("openai", () => ({
      default: class {
        chat = { completions: { create: createMock } };
      },
    }));
  });

  afterEach(() => {
    vi.doUnmock("openai");
    vi.resetModules();
  });

  it("returns text + usage from non-streaming completion", async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: "hi there" } }],
      usage: { prompt_tokens: 10, completion_tokens: 3 },
    });
    const { openaiProvider } = await import("./openai");
    const resp = await openaiProvider.chat({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "q" },
      ],
      maxTokens: 50,
      temperature: 0.5,
    });
    expect(resp.text).toBe("hi there");
    expect(resp.provider).toBe("openai");
    expect(resp.model).toBe("gpt-4o");
    expect(resp.usage).toEqual({ inputTokens: 10, outputTokens: 3 });

    const call = createMock.mock.calls[0][0];
    expect(call.stream).toBeUndefined();
    expect(call.messages).toEqual([
      { role: "system", content: "sys" },
      { role: "user", content: "q" },
    ]);
    expect(call.max_tokens).toBe(50);
    expect(call.temperature).toBe(0.5);
  });

  it("returns empty string when the completion has no content", async () => {
    createMock.mockResolvedValue({ choices: [{ message: {} }] });
    const { openaiProvider } = await import("./openai");
    const resp = await openaiProvider.chat({
      model: "gpt-4o",
      messages: [{ role: "user", content: "q" }],
    });
    expect(resp.text).toBe("");
  });

  it("streams deltas and returns the concatenated text", async () => {
    async function* iter() {
      yield { choices: [{ delta: { content: "he" } }] };
      yield { choices: [{ delta: { content: "llo" } }] };
      yield { choices: [{ delta: {} }] };
    }
    createMock.mockResolvedValue(iter());
    const { openaiProvider } = await import("./openai");
    const deltas: string[] = [];
    const resp = await openaiProvider.chatStream(
      { model: "gpt-4o", messages: [{ role: "user", content: "q" }] },
      (d) => deltas.push(d),
    );
    expect(deltas).toEqual(["he", "llo"]);
    expect(resp.text).toBe("hello");
    expect(createMock.mock.calls[0][0].stream).toBe(true);
  });
});

describe("providers index", () => {
  it("registers all three provider ids", async () => {
    const { providers } = await import("./index");
    expect(Object.keys(providers).sort()).toEqual(["anthropic", "google", "openai"]);
    expect(providers.openai.id).toBe("openai");
    expect(providers.anthropic.id).toBe("anthropic");
    expect(providers.google.id).toBe("google");
  });

  it("configuredProviderIds reflects env state", async () => {
    const keys = ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_API_KEY"] as const;
    const original: Record<string, string | undefined> = {};
    for (const k of keys) original[k] = process.env[k];
    try {
      process.env.OPENAI_API_KEY = "set";
      process.env.ANTHROPIC_API_KEY = "";
      delete process.env.GOOGLE_API_KEY;
      const { configuredProviderIds, hasAnyProvider } = await import("./index");
      expect(configuredProviderIds()).toEqual(["openai"]);
      expect(hasAnyProvider()).toBe(true);
    } finally {
      for (const k of keys) {
        if (original[k] === undefined) delete process.env[k];
        else process.env[k] = original[k];
      }
    }
  });
});
