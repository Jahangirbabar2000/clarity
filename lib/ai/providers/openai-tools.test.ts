import { describe, it, expect, beforeEach, vi } from "vitest";

const createMock = vi.fn();

vi.mock("openai", () => {
  class FakeOpenAI {
    chat = { completions: { create: createMock } };
    constructor(_: unknown) {
      // no-op
    }
  }
  return { default: FakeOpenAI };
});

beforeEach(() => {
  process.env.OPENAI_API_KEY = "sk-test";
  createMock.mockReset();
  vi.resetModules();
});

async function load() {
  const mod = await import("./openai-tools");
  return mod.openaiChatWithTools;
}

describe("openaiChatWithTools", () => {
  it("returns the final text when the model answers with no tool calls", async () => {
    createMock.mockResolvedValueOnce({
      choices: [{ message: { role: "assistant", content: "hello world", tool_calls: undefined } }],
      usage: { prompt_tokens: 10, completion_tokens: 3 },
    });
    const openaiChatWithTools = await load();
    const result = await openaiChatWithTools({
      model: "gpt-4o",
      messages: [{ role: "user", content: "hi" }],
      tools: [],
      executor: vi.fn(),
    });
    expect(result.text).toBe("hello world");
    expect(result.toolCalls).toEqual([]);
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 3 });
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("executes a tool call then returns the final answer on the second turn", async () => {
    createMock
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: "assistant",
              content: "",
              tool_calls: [
                {
                  id: "tc_1",
                  type: "function",
                  function: {
                    name: "listExistingTicketTitles",
                    arguments: JSON.stringify({ limit: 5 }),
                  },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 20, completion_tokens: 5 },
      })
      .mockResolvedValueOnce({
        choices: [{ message: { role: "assistant", content: "final answer", tool_calls: undefined } }],
        usage: { prompt_tokens: 25, completion_tokens: 8 },
      });
    const executor = vi.fn().mockResolvedValue({ count: 2, titles: [{ title: "a" }, { title: "b" }] });
    const onToolCall = vi.fn();
    const openaiChatWithTools = await load();
    const result = await openaiChatWithTools({
      model: "gpt-4o",
      messages: [{ role: "user", content: "review this" }],
      tools: [],
      executor,
      onToolCall,
    });
    expect(executor).toHaveBeenCalledWith("listExistingTicketTitles", { limit: 5 });
    expect(result.text).toBe("final answer");
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe("listExistingTicketTitles");
    expect(result.toolCalls[0].error).toBeUndefined();
    // Usage is summed across both turns.
    expect(result.usage).toEqual({ inputTokens: 45, outputTokens: 13 });
    expect(onToolCall).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it("captures an executor error as a tool-call error without throwing", async () => {
    createMock
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: "assistant",
              content: "",
              tool_calls: [
                {
                  id: "tc_err",
                  type: "function",
                  function: { name: "brokenTool", arguments: "{}" },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      })
      .mockResolvedValueOnce({
        choices: [{ message: { role: "assistant", content: "done", tool_calls: undefined } }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      });
    const executor = vi.fn().mockRejectedValue(new Error("tool kaboom"));
    const openaiChatWithTools = await load();
    const result = await openaiChatWithTools({
      model: "gpt-4o",
      messages: [{ role: "user", content: "go" }],
      tools: [],
      executor,
    });
    expect(result.toolCalls[0].error).toBe("tool kaboom");
    expect(result.text).toBe("done");
  });

  it("stops at the iteration cap and returns whatever was gathered", async () => {
    // Always return a tool call so the loop exhausts.
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            role: "assistant",
            content: "",
            tool_calls: [
              {
                id: "loop",
                type: "function",
                function: { name: "spin", arguments: "{}" },
              },
            ],
          },
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });
    const executor = vi.fn().mockResolvedValue({ ok: true });
    const openaiChatWithTools = await load();
    const result = await openaiChatWithTools({
      model: "gpt-4o",
      messages: [{ role: "user", content: "spin" }],
      tools: [],
      executor,
      maxIterations: 2,
    });
    expect(result.text).toBe("");
    expect(result.toolCalls).toHaveLength(2);
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it("throws when OPENAI_API_KEY is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    const openaiChatWithTools = await load();
    await expect(
      openaiChatWithTools({
        model: "gpt-4o",
        messages: [{ role: "user", content: "hi" }],
        tools: [],
        executor: vi.fn(),
      }),
    ).rejects.toThrow(/OPENAI_API_KEY/);
  });
});
