import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { getTicketWithRelations } from "@/lib/db/queries";

const patchSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  acceptanceCriteria: z.array(z.string()).optional(),
  edgeCases: z.array(z.string()).optional(),
  outOfScope: z.array(z.string()).optional(),
  type: z.enum(["FEATURE", "BUG", "IMPROVEMENT", "SPIKE"]).optional(),
  priority: z.enum(["HIGH", "MED", "LOW"]).optional(),
  storyPoints: z.number().int().nullable().optional(),
  status: z.enum(["DRAFT", "REVIEWED", "PUSHED"]).optional(),
  subtasks: z
    .array(
      z.object({
        id: z.string().optional(),
        title: z.string(),
        description: z.string(),
        type: z.enum(["FRONTEND", "BACKEND", "DATABASE", "TESTING", "INFRA", "DEVOPS", "PM"]),
        storyPoints: z.number().int(),
        priority: z.enum(["HIGH", "MED", "LOW"]),
        dependsOn: z.array(z.string()).default([]),
        suggestedSprint: z.number().int().nullable().optional(),
        order: z.number().int(),
      }),
    )
    .optional(),
});

export const dynamic = "force-dynamic";

export async function GET(_: Request, ctx: { params: { ticketId: string } }) {
  const ticket = await getTicketWithRelations(ctx.params.ticketId);
  if (!ticket) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ticket });
}

export async function PATCH(req: Request, ctx: { params: { ticketId: string } }) {
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Bad input" }, { status: 400 });
  const { subtasks, ...rest } = parsed.data;

  await prisma.$transaction(async (tx) => {
    if (Object.keys(rest).length > 0) {
      await tx.ticket.update({ where: { id: ctx.params.ticketId }, data: rest });
    }
    if (subtasks) {
      const existing = await tx.subtask.findMany({ where: { ticketId: ctx.params.ticketId } });
      const existingIds = new Set(existing.map((s) => s.id));
      const incomingIds = new Set(subtasks.filter((s) => s.id).map((s) => s.id!));
      for (const id of existingIds) {
        if (!incomingIds.has(id)) await tx.subtask.delete({ where: { id } });
      }
      for (const s of subtasks) {
        if (s.id && existingIds.has(s.id)) {
          await tx.subtask.update({
            where: { id: s.id },
            data: {
              title: s.title,
              description: s.description,
              type: s.type,
              storyPoints: s.storyPoints,
              priority: s.priority,
              dependsOn: s.dependsOn,
              suggestedSprint: s.suggestedSprint ?? undefined,
              order: s.order,
            },
          });
        } else {
          await tx.subtask.create({
            data: {
              ticketId: ctx.params.ticketId,
              title: s.title,
              description: s.description,
              type: s.type,
              storyPoints: s.storyPoints,
              priority: s.priority,
              dependsOn: s.dependsOn,
              suggestedSprint: s.suggestedSprint ?? undefined,
              order: s.order,
            },
          });
        }
      }
    }
  });

  const ticket = await getTicketWithRelations(ctx.params.ticketId);
  return NextResponse.json({ ticket });
}

export async function DELETE(_: Request, ctx: { params: { ticketId: string } }) {
  await prisma.ticket.delete({ where: { id: ctx.params.ticketId } });
  return NextResponse.json({ ok: true });
}
