import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { ensureDemoOrg } from "@/lib/db/queries";
import { assembleContext } from "@/lib/context/context-assembler";
import { buildTicketStream } from "@/lib/ai/ticket-builder";

const body = z.object({ idea: z.string().min(1), orgId: z.string().optional() });

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "idea required" }), { status: 400 });
  }
  const { idea, orgId } = parsed.data;

  const org = orgId ? await prisma.organization.findUnique({ where: { id: orgId } }) : await ensureDemoOrg();
  if (!org) return new Response(JSON.stringify({ error: "Org not found" }), { status: 404 });

  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController, data: unknown) => {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  };

  const stream = new ReadableStream({
    async start(controller) {
      try {
        send(controller, { phase: "context", message: "Assembling context from your connected sources…" });
        const ctx = await assembleContext(org.id);

        send(controller, {
          phase: "context_ready",
          sources: ctx.sources,
          techStack: ctx.techStack,
          files: ctx.relevantFiles.map((f) => f.path),
        });

        send(controller, { phase: "generating", message: "Writing ticket with Claude…" });

        const payload = await buildTicketStream(idea, ctx, (chunk) => {
          send(controller, { phase: "chunk", text: chunk });
        });

        const activeSources = Object.entries(ctx.sources)
          .filter(([, v]) => (typeof v === "number" ? v > 0 : v))
          .map(([k]) => k);

        const ticket = await prisma.ticket.create({
          data: {
            orgId: org.id,
            title: payload.ticket.title,
            description: payload.ticket.description,
            acceptanceCriteria: payload.ticket.acceptanceCriteria,
            edgeCases: payload.ticket.edgeCases,
            outOfScope: payload.ticket.outOfScope,
            type: payload.ticket.type,
            priority: payload.ticket.priority,
            storyPoints: payload.ticket.storyPoints,
            suggestedLabels: payload.ticket.suggestedLabels,
            contextSources: activeSources,
            status: "DRAFT",
            subtasks: {
              create: payload.subtasks.map((s, i) => ({
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

        send(controller, { phase: "done", ticketId: ticket.id, ticket });
      } catch (err) {
        send(controller, { phase: "error", message: err instanceof Error ? err.message : "unknown error" });
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
