import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { planSprints } from "@/lib/ai/sprint-planner";

const schema = z.object({
  ticketId: z.string(),
  velocityPerSprint: z.number().int().positive().default(20),
  sprintLengthWeeks: z.number().int().positive().default(2),
});

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Bad input" }, { status: 400 });
  const { ticketId, velocityPerSprint, sprintLengthWeeks } = parsed.data;

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { subtasks: { orderBy: { order: "asc" } } },
  });
  if (!ticket) return NextResponse.json({ error: "not found" }, { status: 404 });

  const planned = planSprints(ticket.subtasks, velocityPerSprint, sprintLengthWeeks);

  const result = await prisma.$transaction(async (tx) => {
    await tx.sprintAssignment.deleteMany({ where: { ticketId } });

    const sprints = [];
    for (const p of planned) {
      const sprint = await tx.sprint.create({
        data: {
          orgId: ticket.orgId,
          name: p.name,
          goal: p.goal,
          committedPoints: p.committedPoints,
          velocityTarget: p.velocityTarget,
          order: p.order,
        },
      });
      for (const s of p.subtasks) {
        await tx.sprintAssignment.create({
          data: { sprintId: sprint.id, subtaskId: s.id, ticketId: ticket.id },
        });
      }
      sprints.push({ ...sprint, subtasks: p.subtasks });
    }
    return sprints;
  });

  return NextResponse.json({ sprints: result });
}
