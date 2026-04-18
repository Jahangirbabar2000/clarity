import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { createJiraIssue } from "@/lib/integrations/jira";

const schema = z.object({ ticketId: z.string() });

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Bad input" }, { status: 400 });

  const ticket = await prisma.ticket.findUnique({
    where: { id: parsed.data.ticketId },
    include: { subtasks: { orderBy: { order: "asc" } }, org: true },
  });
  if (!ticket) return NextResponse.json({ error: "not found" }, { status: 404 });

  const projectKey = ticket.org.jiraProjectKey ?? "CLAR";

  const ticketBody = [
    ticket.description,
    "",
    "Acceptance Criteria:",
    ...ticket.acceptanceCriteria.map((c) => `• ${c}`),
    "",
    "Edge Cases:",
    ...ticket.edgeCases.map((c) => `• ${c}`),
    "",
    "Out of Scope:",
    ...ticket.outOfScope.map((c) => `• ${c}`),
  ].join("\n");

  const issueType = ticket.type === "BUG" ? "Bug" : ticket.type === "SPIKE" ? "Spike" : "Story";
  const parent = await createJiraIssue({
    projectKey,
    summary: ticket.title,
    description: ticketBody,
    issueType,
    labels: ticket.suggestedLabels,
  });

  const subtaskResults: { subtaskId: string; url: string }[] = [];
  for (const s of ticket.subtasks) {
    const child = await createJiraIssue({
      projectKey,
      summary: s.title,
      description: s.description,
      issueType: "Task",
      parentKey: parent.key,
    });
    await prisma.subtask.update({ where: { id: s.id }, data: { jiraId: child.key, jiraUrl: child.url } });
    subtaskResults.push({ subtaskId: s.id, url: child.url });
  }

  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { jiraId: parent.key, jiraUrl: parent.url, status: "PUSHED" },
  });

  return NextResponse.json({ parentJiraUrl: parent.url, subtaskUrls: subtaskResults });
}
