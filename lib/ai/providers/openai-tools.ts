/**
 * Thin tool-calling helper on top of the OpenAI SDK.
 *
 * Implements the standard OpenAI tool-use loop:
 *
 *   1. Send user messages + tool definitions to the model
 *   2. If response contains tool_calls, execute each one and append the
 *      result as a tool message
 *   3. Re-send the conversation; continue until the model returns a plain
 *      text reply with no more tool_calls (or we hit the iteration cap)
 *
 * Kept deliberately minimal: the Critic is currently the only caller, and
 * the tool universe is small enough that a simple loop is clearer than a
 * full agent framework. If we add more tool-using agents later we can
 * generalize this into a shared helper.
 */

import OpenAI from "openai";
import type { ChatMessage, ChatResponse } from "./types";

type ToolExecutor = (
  name: string,
  args: Record<string, unknown>,
) => Promise<unknown>;

type OpenAIToolSchema = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export interface ToolCallRecord {
  name: string;
  args: Record<string, unknown>;
  /** JSON-encoded preview of the result, trimmed for logs/UI. */
  resultPreview: string;
  durationMs: number;
  error?: string;
}

export interface ChatWithToolsResult extends ChatResponse {
  toolCalls: ToolCallRecord[];
}

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (client) return client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  client = new OpenAI({ apiKey });
  return client;
}

export async function openaiChatWithTools(params: {
  model: string;
  messages: ChatMessage[];
  tools: OpenAIToolSchema[];
  executor: ToolExecutor;
  onToolCall?: (record: ToolCallRecord) => void;
  maxTokens?: number;
  temperature?: number;
  maxIterations?: number;
}): Promise<ChatWithToolsResult> {
  const openai = getClient();
  const maxIterations = params.maxIterations ?? 4;
  const toolCalls: ToolCallRecord[] = [];

  // OpenAI's messages array grows as we add assistant tool_calls and tool
  // responses. We keep a local copy instead of mutating the caller's.
  const convo: OpenAI.Chat.ChatCompletionMessageParam[] = params.messages.map(
    (m) => ({ role: m.role, content: m.content }),
  );

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (let iter = 0; iter < maxIterations; iter++) {
    const resp = await openai.chat.completions.create({
      model: params.model,
      messages: convo,
      tools: params.tools,
      tool_choice: "auto",
      max_tokens: params.maxTokens,
      temperature: params.temperature,
    });

    totalInputTokens += resp.usage?.prompt_tokens ?? 0;
    totalOutputTokens += resp.usage?.completion_tokens ?? 0;

    const choice = resp.choices[0];
    if (!choice) break;

    const msg = choice.message;

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return {
        text: msg.content ?? "",
        model: params.model,
        provider: "openai",
        usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
        toolCalls,
      };
    }

    // Add the assistant turn (with tool_calls) to the convo before the tool responses.
    convo.push({
      role: "assistant",
      content: msg.content ?? "",
      tool_calls: msg.tool_calls.map((tc) => ({
        id: tc.id,
        type: tc.type,
        function: tc.function,
      })),
    });

    for (const tc of msg.tool_calls) {
      if (tc.type !== "function") continue;
      const name = tc.function.name;
      let args: Record<string, unknown> = {};
      try {
        args = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
      } catch {
        args = {};
      }
      const started = Date.now();
      let result: unknown;
      let errorMsg: string | undefined;
      try {
        result = await params.executor(name, args);
      } catch (err) {
        errorMsg = err instanceof Error ? err.message : String(err);
        result = { error: errorMsg };
      }
      const duration = Date.now() - started;
      const serialized = JSON.stringify(result);
      const preview = serialized.length > 400 ? serialized.slice(0, 400) + "…" : serialized;
      const record: ToolCallRecord = {
        name,
        args,
        resultPreview: preview,
        durationMs: duration,
        error: errorMsg,
      };
      toolCalls.push(record);
      params.onToolCall?.(record);

      convo.push({
        role: "tool",
        tool_call_id: tc.id,
        content: serialized,
      });
    }
  }

  // Hit iteration cap without a final text answer — return what we have.
  return {
    text: "",
    model: params.model,
    provider: "openai",
    usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
    toolCalls,
  };
}
