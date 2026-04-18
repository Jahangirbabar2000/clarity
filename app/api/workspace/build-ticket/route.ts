import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { ensureDemoOrg } from "@/lib/db/queries";
import { runBuildTicketPipeline } from "@/lib/ai/pipeline";
import type { AgentEvent } from "@/lib/ai/agents";

const body = z.object({ idea: z.string().min(1), orgId: z.string().optional() });

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Streaming SSE endpoint for the multi-agent ticket pipeline.
 *
 * Event kinds sent to the client:
 *   - { phase: "context" | "context_ready" | "generating" | "chunk" | "done" | "error", ... }
 *       Legacy events kept for backwards compatibility with the existing UI.
 *   - { agent_event: AgentEvent }
 *       Per-agent lifecycle events from the pipeline (start / progress / stream /
 *       done / error), used by the UI telemetry panel to render a live
 *       agent-by-agent timeline with model + provider labels.
 */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "idea required" }), { status: 400 });
  }
  const { idea, orgId } = parsed.data;

  const org = orgId
    ? await prisma.organization.findUnique({ where: { id: orgId } })
    : await ensureDemoOrg();
  if (!org) return new Response(JSON.stringify({ error: "Org not found" }), { status: 404 });

  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController, data: unknown) => {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  };

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: AgentEvent) => {
        send(controller, { agent_event: event });

        // Translate agent events into the legacy phase events the existing UI listens for,
        // so the current IdeaInput / TicketEditor progress strings keep working unchanged.
        if (event.type === "agent_start") {
          if (event.agent === "ContextAgent") {
            send(controller, { phase: "context", message: event.message });
          } else if (event.agent === "TicketWriterAgent") {
            send(controller, { phase: "generating", message: event.message });
          }
        }
        if (event.type === "agent_stream" && event.agent === "TicketWriterAgent") {
          send(controller, { phase: "chunk", text: event.text });
        }
      };

      try {
        const { context, draft, critique } = await runBuildTicketPipeline(
          idea,
          org.id,
          emit,
        );

        // Surface the context snapshot the old UI expects.
        send(controller, {
          phase: "context_ready",
          sources: context.raw.sources,
          techStack: context.raw.techStack,
          files: context.raw.relevantFiles.map((f) => f.path),
          brief: context.brief,
        });

        const activeSources = Object.entries(context.raw.sources)
          .filter(([, v]) => (typeof v === "number" ? v > 0 : v))
          .map(([k]) => k);

        const ticket = await prisma.ticket.create({
          data: {
            orgId: org.id,
            title: draft.ticket.title,
            description: draft.ticket.description,
            acceptanceCriteria: draft.ticket.acceptanceCriteria,
            edgeCases: draft.ticket.edgeCases,
            outOfScope: draft.ticket.outOfScope,
            type: draft.ticket.type,
            priority: draft.ticket.priority,
            storyPoints: draft.ticket.storyPoints,
            suggestedLabels: draft.ticket.suggestedLabels,
            contextSources: activeSources,
            status: "DRAFT",
            subtasks: {
              create: draft.subtasks.map((s, i) => ({
                title: s.title,
                description: s.description,
                type: s.type,
                storyPoints: s.storyPoints,
                priority: s.priority,
                dependsOn: s.dependsOn,
                suggestedSprint: s.suggestedSprint,
                order: i,
              })),
            },
          },
          include: { subtasks: { orderBy: { order: "asc" } } },
        });

        send(controller, {
          phase: "done",
          ticketId: ticket.id,
          ticket,
          critique,
        });
      } catch (err) {
        send(controller, {
          phase: "error",
          message: err instanceof Error ? err.message : "unknown error",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
