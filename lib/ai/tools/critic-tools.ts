/**
 * Tools the CriticAgent can call during review.
 *
 * Each tool has:
 *   - a JSON schema (OpenAI-compatible "function" tool schema)
 *   - an `execute` implementation that runs server-side with access to Prisma
 *
 * Why tools matter here: the Critic's job is to flag duplicates, scope creep,
 * and story-point mismatches. Those judgments are much stronger when grounded
 * in actual data from the org (e.g. "there are already 3 tickets about
 * checkout currency — this is #4") rather than guessed from the draft alone.
 *
 * Tool use is currently routed through OpenAI (the Critic's primary provider).
 * If OpenAI isn't configured, the Critic falls back to plain `routeChat` with
 * no tools — still functional, just less grounded.
 */

import { prisma } from "@/lib/db/client";

export type ToolCallContext = {
  orgId?: string;
};

export type CriticTool = {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
  execute: (args: Record<string, unknown>, ctx: ToolCallContext) => Promise<unknown>;
};

/**
 * Tool definitions in the OpenAI `function` tool schema.
 * Returns the JSON-serializable array we send to the API.
 */
export const CRITIC_TOOLS: CriticTool[] = [
  {
    name: "listExistingTicketTitles",
    description:
      "List titles of tickets already created in this organization. Use this to detect potential duplicates of the draft being reviewed.",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "integer",
          description: "Max number of titles to return (default 50, max 100).",
          default: 50,
        },
      },
      required: [],
      additionalProperties: false,
    },
    async execute(args, ctx) {
      if (!ctx.orgId) return { titles: [], note: "no org scope" };
      const limit = Math.min(Math.max(Number(args.limit ?? 50), 1), 100);
      const rows = await prisma.ticket.findMany({
        where: { orgId: ctx.orgId },
        select: { title: true, type: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      return {
        count: rows.length,
        titles: rows.map((r) => ({
          title: r.title,
          type: r.type,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
        })),
      };
    },
  },
  {
    name: "getSubtaskTypeDistribution",
    description:
      "Return how subtask types are typically split in this organization's existing tickets. Use this to flag drafts whose subtask mix is unusually skewed (e.g. all FRONTEND, no TESTING).",
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
    async execute(_args, ctx) {
      if (!ctx.orgId) return { distribution: {}, note: "no org scope" };
      const rows = await prisma.subtask.findMany({
        where: { ticket: { orgId: ctx.orgId } },
        select: { type: true },
        take: 500,
      });
      const dist: Record<string, number> = {};
      for (const r of rows) dist[r.type] = (dist[r.type] ?? 0) + 1;
      return { total: rows.length, distribution: dist };
    },
  },
];

export const CRITIC_TOOLS_BY_NAME: Record<string, CriticTool> = Object.fromEntries(
  CRITIC_TOOLS.map((t) => [t.name, t]),
);

/** OpenAI `tools` parameter shape for chat.completions. */
export function criticToolsAsOpenAISchema() {
  return CRITIC_TOOLS.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}
