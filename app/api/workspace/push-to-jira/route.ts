import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { createJiraIssue, getJiraBoardId, getOrCreateJiraSprint, assignIssuesToJiraSprint } from "@/lib/integrations/jira";

const schema = z.object({ ticketId: z.string() });

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Bad input" }, { status: 400 });

  const ticket = await prisma.ticket.findUnique({
    where: { id: parsed.data.ticketId },
    include: {
      subtasks: {
        orderBy: { order: "asc" },
        include: { sprintAssignment: { include: { sprint: true } } },
      },
      org: true,
    },
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

  // Build sprint → issue keys map so we can assign to Jira sprints after creation
  const sprintKeyMap = new Map<string, string[]>(); // sprintName → jiraKeys

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

    // Track which sprint this subtask belongs to
    const sprintName = (s as typeof s & { sprintAssignment?: { sprint: { name: string } } | null }).sprintAssignment?.sprint?.name;
    if (sprintName) {
      const existing = sprintKeyMap.get(sprintName) ?? [];
      existing.push(child.key);
      sprintKeyMap.set(sprintName, existing);
    }
  }

  // Sync sprint assignments to Jira Agile API (best-effort — never block the push)
  if (sprintKeyMap.size > 0) {
    try {
      const boardId = await getJiraBoardId(projectKey);
      if (boardId) {
        for (const [sprintName, issueKeys] of sprintKeyMap) {
          const jiraSprintId = await getOrCreateJiraSprint(boardId, sprintName);
          if (jiraSprintId) await assignIssuesToJiraSprint(jiraSprintId, issueKeys);
        }
      }
    } catch { /* sprint sync is non-blocking */ }
  }

  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { jiraId: parent.key, jiraUrl: parent.url, status: "PUSHED" },
  });

  return NextResponse.json({ parentJiraUrl: parent.url, subtaskUrls: subtaskResults });
}
