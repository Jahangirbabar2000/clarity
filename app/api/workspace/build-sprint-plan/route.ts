import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { planSprintsForProject } from "@/lib/ai/sprint-planner";

const schema = z.object({
  projectId: z.string(),
  ticketId: z.string().optional(),
  velocityPerSprint: z.number().int().positive().default(20),
  sprintLengthWeeks: z.number().int().positive().default(2),
});

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Bad input" }, { status: 400 });
  const { projectId, ticketId, velocityPerSprint, sprintLengthWeeks } = parsed.data;

  // Fetch all subtasks for the project (all tickets)
  const tickets = await prisma.ticket.findMany({
    where: { orgId: projectId },
    include: { subtasks: { orderBy: { order: "asc" } } },
  });

  if (tickets.length === 0) return NextResponse.json({ error: "No tickets found" }, { status: 404 });

  const allSubtasks = tickets.flatMap((t) => t.subtasks);

  // Fetch existing sprints to carry over capacity info
  const existingSprints = await prisma.sprint.findMany({
    where: { orgId: projectId },
    orderBy: { order: "asc" },
    include: { assignments: true },
  });

  const existingSlots = existingSprints.map((s) => ({
    id: s.id,
    order: s.order,
    name: s.name,
    velocityTarget: s.velocityTarget,
    // Count only committed points from OTHER tickets (not the one being re-planned)
    committedPoints: s.assignments
      .filter((a) => ticketId ? a.ticketId !== ticketId : true)
      .reduce((sum, a) => {
        const subtask = allSubtasks.find((st) => st.id === a.subtaskId);
        return sum + (subtask?.storyPoints ?? 0);
      }, 0),
  }));

  const planned = planSprintsForProject(allSubtasks, existingSlots, velocityPerSprint, sprintLengthWeeks);

  const result = await prisma.$transaction(async (tx) => {
    // Clear only assignments for the tickets being re-planned
    const ticketIds = ticketId ? [ticketId] : tickets.map((t) => t.id);
    await tx.sprintAssignment.deleteMany({ where: { ticketId: { in: ticketIds } } });

    // Delete sprints that are now empty after clearing
    const remainingAssignments = await tx.sprintAssignment.findMany({ where: { sprint: { orgId: projectId } } });
    const usedSprintIds = new Set(remainingAssignments.map((a) => a.sprintId));
    const emptyOldSprints = existingSprints.filter((s) => !usedSprintIds.has(s.id));
    if (emptyOldSprints.length > 0) {
      await tx.sprint.deleteMany({ where: { id: { in: emptyOldSprints.map((s) => s.id) } } });
    }

    const sprintRecords = [];
    for (const p of planned) {
      if (p.subtasks.length === 0) continue;

      // Reuse existing sprint by order if possible
      const existing = existingSprints.find((s) => s.order === p.order && !emptyOldSprints.some((e) => e.id === s.id));
      let sprint;
      if (existing) {
        sprint = await tx.sprint.update({
          where: { id: existing.id },
          data: { committedPoints: p.committedPoints },
        });
      } else {
        sprint = await tx.sprint.create({
          data: {
            orgId: projectId,
            name: p.name,
            goal: p.goal,
            committedPoints: p.committedPoints,
            velocityTarget: p.velocityTarget,
            order: p.order,
          },
        });
      }

      for (const s of p.subtasks) {
        const parentTicket = tickets.find((t) => t.subtasks.some((st) => st.id === s.id));
        if (!parentTicket) continue;
        await tx.sprintAssignment.create({
          data: { sprintId: sprint.id, subtaskId: s.id, ticketId: parentTicket.id },
        });
      }
      sprintRecords.push({ ...sprint, subtasks: p.subtasks });
    }
    return sprintRecords;
  });

  return NextResponse.json({ sprints: result });
}
