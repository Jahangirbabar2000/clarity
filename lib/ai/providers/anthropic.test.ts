import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { splitSystem } from "./anthropic";

describe("anthropic splitSystem", () => {
  it("extracts a single system message", () => {
    const { system, rest } = splitSystem([
      { role: "system", content: "sys" },
      { role: "user", content: "hi" },
    ]);
    expect(system).toBe("sys");
    expect(rest).toEqual([{ role: "user", content: "hi" }]);
  });

  it("joins multiple system messages with two newlines", () => {
    const { system, rest } = splitSystem([
      { role: "system", content: "sys1" },
      { role: "system", content: "sys2" },
      { role: "user", content: "u" },
    ]);
    expect(system).toBe("sys1\n\nsys2");
    expect(rest).toHaveLength(1);
  });

  it("returns empty system when none present", () => {
    const { system, rest } = splitSystem([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hey" },
    ]);
    expect(system).toBe("");
    expect(rest).toHaveLength(2);
  });

  it("preserves order of non-system messages", () => {
    const { rest } = splitSystem([
      { role: "user", content: "u1" },
      { role: "system", content: "sys" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "u2" },
    ]);
    expect(rest.map((m) => m.content)).toEqual(["u1", "a1", "u2"]);
  });
});

describe("anthropicProvider.isConfigured", () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  afterEach(() => {
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it("returns true when key is set", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    const { anthropicProvider } = await import("./anthropic");
    expect(anthropicProvider.isConfigured()).toBe(true);
  });

  it("returns false when key is empty", async () => {
    process.env.ANTHROPIC_API_KEY = "";
    const { anthropicProvider } = await import("./anthropic");
    expect(anthropicProvider.isConfigured()).toBe(false);
  });
});

describe("anthropicProvider.chat (mocked SDK)", () => {
  const createMock = vi.fn();

  beforeEach(() => {
    createMock.mockReset();
    process.env.ANTHROPIC_API_KEY = "sk-test";
    vi.resetModules();
    vi.doMock("@anthropic-ai/sdk", () => {
      return {
        default: class {
          messages = { create: createMock };
        },
      };
    });
  });

  afterEach(() => {
    vi.doUnmock("@anthropic-ai/sdk");
  });

  it("passes system + rest messages correctly and extracts text", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "text", text: "hello world" }],
      usage: { input_tokens: 5, output_tokens: 2 },
    });
    const { anthropicProvider } = await import("./anthropic");
    const resp = await anthropicProvider.chat({
      model: "claude-sonnet-4-5",
      messages: [
        { role: "system", content: "you are clarity" },
        { role: "user", content: "hi" },
      ],
      maxTokens: 100,
      temperature: 0.3,
    });
    expect(resp.text).toBe("hello world");
    expect(resp.provider).toBe("anthropic");
    expect(resp.model).toBe("claude-sonnet-4-5");
    expect(resp.usage).toEqual({ inputTokens: 5, outputTokens: 2 });

    const call = createMock.mock.calls[0][0];
    expect(call.system).toBe("you are clarity");
    expect(call.messages).toEqual([{ role: "user", content: "hi" }]);
    expect(call.max_tokens).toBe(100);
    expect(call.temperature).toBe(0.3);
  });

  it("filters non-text content blocks", async () => {
    createMock.mockResolvedValue({
      content: [
        { type: "text", text: "a" },
        { type: "tool_use", id: "t1" },
        { type: "text", text: "b" },
      ],
      usage: { input_tokens: 0, output_tokens: 0 },
    });
    const { anthropicProvider } = await import("./anthropic");
    const resp = await anthropicProvider.chat({
      model: "x",
      messages: [{ role: "user", content: "q" }],
    });
    expect(resp.text).toBe("ab");
  });

  it("streams deltas via content_block_delta events", async () => {
    async function* events() {
      yield { type: "content_block_delta", delta: { type: "text_delta", text: "he" } };
      yield { type: "content_block_delta", delta: { type: "text_delta", text: "llo" } };
      yield { type: "message_stop" };
    }
    const streamMock = vi.fn().mockReturnValue(events());
    vi.doUnmock("@anthropic-ai/sdk");
    vi.resetModules();
    vi.doMock("@anthropic-ai/sdk", () => ({
      default: class {
        messages = { stream: streamMock };
      },
    }));
    const { anthropicProvider } = await import("./anthropic");
    const deltas: string[] = [];
    const resp = await anthropicProvider.chatStream(
      {
        model: "claude-sonnet-4-5",
        messages: [{ role: "user", content: "q" }],
      },
      (d) => deltas.push(d),
    );
    expect(deltas).toEqual(["he", "llo"]);
    expect(resp.text).toBe("hello");
  });

  it("maps role=assistant correctly (anthropic only accepts user|assistant)", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "text", text: "" }],
      usage: { input_tokens: 0, output_tokens: 0 },
    });
    const { anthropicProvider } = await import("./anthropic");
    await anthropicProvider.chat({
      model: "x",
      messages: [
        { role: "user", content: "q" },
        { role: "assistant", content: "a" },
        { role: "user", content: "q2" },
      ],
    });
    const call = createMock.mock.calls[0][0];
    expect(call.messages.map((m: { role: string }) => m.role)).toEqual(["user", "assistant", "user"]);
  });
});
