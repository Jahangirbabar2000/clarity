import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/client", () => {
  return {
    prisma: {
      ticket: { findMany: vi.fn() },
      subtask: { findMany: vi.fn() },
    },
  };
});

import { prisma } from "@/lib/db/client";
import {
  CRITIC_TOOLS,
  CRITIC_TOOLS_BY_NAME,
  criticToolsAsOpenAISchema,
} from "./critic-tools";

describe("critic tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("criticToolsAsOpenAISchema", () => {
    it("returns an OpenAI-compatible function tool schema for every tool", () => {
      const schema = criticToolsAsOpenAISchema();
      expect(schema.length).toBe(CRITIC_TOOLS.length);
      for (const t of schema) {
        expect(t.type).toBe("function");
        expect(t.function.name).toBeTypeOf("string");
        expect(t.function.description).toBeTypeOf("string");
        expect(t.function.parameters).toBeTypeOf("object");
      }
    });

    it("exposes every known tool in the by-name index", () => {
      for (const t of CRITIC_TOOLS) {
        expect(CRITIC_TOOLS_BY_NAME[t.name]).toBe(t);
      }
    });
  });

  describe("listExistingTicketTitles", () => {
    it("returns an empty list with a note when no orgId is provided", async () => {
      const tool = CRITIC_TOOLS_BY_NAME.listExistingTicketTitles;
      const result = (await tool.execute({}, {})) as {
        titles: unknown[];
        note: string;
      };
      expect(result.titles).toEqual([]);
      expect(result.note).toBe("no org scope");
      expect(prisma.ticket.findMany).not.toHaveBeenCalled();
    });

    it("queries Prisma scoped to the org and clamps the limit", async () => {
      const now = new Date();
      (prisma.ticket.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { title: "A", type: "FEATURE", status: "OPEN", createdAt: now },
      ]);
      const tool = CRITIC_TOOLS_BY_NAME.listExistingTicketTitles;
      const result = (await tool.execute({ limit: 9999 }, { orgId: "org-1" })) as {
        count: number;
        titles: { title: string }[];
      };
      expect(result.count).toBe(1);
      expect(result.titles[0].title).toBe("A");
      const call = (prisma.ticket.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.where).toEqual({ orgId: "org-1" });
      expect(call.take).toBe(100); // clamped
    });

    it("uses the default limit when none is supplied", async () => {
      (prisma.ticket.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      const tool = CRITIC_TOOLS_BY_NAME.listExistingTicketTitles;
      await tool.execute({}, { orgId: "org-1" });
      const call = (prisma.ticket.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.take).toBe(50);
    });
  });

  describe("getSubtaskTypeDistribution", () => {
    it("returns an empty distribution with note when no orgId", async () => {
      const tool = CRITIC_TOOLS_BY_NAME.getSubtaskTypeDistribution;
      const result = (await tool.execute({}, {})) as {
        distribution: Record<string, number>;
        note: string;
      };
      expect(result.distribution).toEqual({});
      expect(result.note).toBe("no org scope");
    });

    it("aggregates types into a distribution when scoped to an org", async () => {
      (prisma.subtask.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { type: "FRONTEND" },
        { type: "FRONTEND" },
        { type: "BACKEND" },
        { type: "TESTING" },
      ]);
      const tool = CRITIC_TOOLS_BY_NAME.getSubtaskTypeDistribution;
      const result = (await tool.execute({}, { orgId: "org-1" })) as {
        total: number;
        distribution: Record<string, number>;
      };
      expect(result.total).toBe(4);
      expect(result.distribution).toEqual({ FRONTEND: 2, BACKEND: 1, TESTING: 1 });
    });
  });
});
