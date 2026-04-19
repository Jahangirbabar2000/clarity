import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getProjectById } from "@/lib/db/queries";
import { prisma } from "@/lib/db/client";
import {
  getJiraBoardId,
  getJiraSprints,
  getSprintIssues,
  getOrCreateJiraSprint,
  assignIssuesToJiraSprint,
} from "@/lib/integrations/jira";

export const dynamic = "force-dynamic";

// ── GET /api/projects/[projectId]/sprint-plan ─────────────────────────────────
// Returns merged sprint plan: Jira sprints + Clarity ticket assignments.
export async function GET(_req: Request, { params }: { params: { projectId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getProjectById(params.projectId, session.user.id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const projectKey = project.jiraProjectKey ?? null;

  // Fetch Clarity sprint assignments
  const claritySprints = await prisma.sprint.findMany({
    where: { orgId: params.projectId },
    orderBy: { order: "asc" },
    include: {
      assignments: {
        include: {
          subtask: true,
          ticket: { select: { id: true, title: true } },
        },
      },
    },
  });

  // Fetch all unplanned subtasks (no sprint assignment) for this project
  const unplannedSubtasks = await prisma.subtask.findMany({
    where: {
      ticket: { orgId: params.projectId },
      sprintAssignment: null,
    },
    include: { ticket: { select: { id: true, title: true } } },
    orderBy: { order: "asc" },
  });

  // Try fetching Jira sprints + their issues
  let boardId: number | null = null;
  let jiraSprintMap: Map<number, { name: string; state: string; issues: Awaited<ReturnType<typeof getSprintIssues>> }> = new Map();

  if (projectKey) {
    boardId = await getJiraBoardId(projectKey);
    if (boardId) {
      const jiraSprints = await getJiraSprints(boardId);
      await Promise.all(
        jiraSprints.map(async (js) => {
          const issues = await getSprintIssues(js.id);
          jiraSprintMap.set(js.id, { name: js.name, state: js.state, issues });
        }),
      );
    }
  }

  // Build merged sprint columns
  // Start from Jira sprints as the source of truth (if connected)
  // Then overlay Clarity assignments on top
  const claritySubtasksBySprintName = new Map<string, typeof claritySprints[0]["assignments"]>();
  for (const cs of claritySprints) {
    claritySubtasksBySprintName.set(cs.name.toLowerCase(), cs.assignments);
  }

  const mergedSprints: {
    jiraSprintId: number | null;
    claritySprintId: string | null;
    name: string;
    state: string;
    velocityTarget: number;
    jiraIssues: { key: string; title: string; storyPoints: number | null; issueType: string; status: string }[];
    claritySubtasks: { subtaskId: string; ticketId: string; ticketTitle: string; title: string; storyPoints: number; jiraKey: string | null; priority: string }[];
  }[] = [];

  if (jiraSprintMap.size > 0) {
    // Jira-connected: use Jira sprints as columns
    for (const [jiraId, jiraSprint] of jiraSprintMap) {
      const clarityAssignments = claritySubtasksBySprintName.get(jiraSprint.name.toLowerCase()) ?? [];
      const claritySprint = claritySprints.find((cs) => cs.name.toLowerCase() === jiraSprint.name.toLowerCase());

      // Filter Jira issues to exclude ones already tracked as Clarity subtasks (avoid duplication)
      const clarityJiraKeys = new Set(clarityAssignments.map((a) => a.subtask.jiraId).filter(Boolean));
      const filteredJiraIssues = jiraSprint.issues.filter((i) => !clarityJiraKeys.has(i.key));

      mergedSprints.push({
        jiraSprintId: jiraId,
        claritySprintId: claritySprint?.id ?? null,
        name: jiraSprint.name,
        state: jiraSprint.state,
        velocityTarget: claritySprint?.velocityTarget ?? 20,
        jiraIssues: filteredJiraIssues,
        claritySubtasks: clarityAssignments.map((a) => ({
          subtaskId: a.subtask.id,
          ticketId: a.ticket.id,
          ticketTitle: a.ticket.title,
          title: a.subtask.title,
          storyPoints: a.subtask.storyPoints,
          jiraKey: a.subtask.jiraId,
          priority: a.subtask.priority,
        })),
      });
    }

    // Add any Clarity-only sprints that don't match a Jira sprint
    for (const cs of claritySprints) {
      const alreadyIncluded = [...jiraSprintMap.values()].some(
        (js) => js.name.toLowerCase() === cs.name.toLowerCase(),
      );
      if (!alreadyIncluded) {
        mergedSprints.push({
          jiraSprintId: null,
          claritySprintId: cs.id,
          name: cs.name,
          state: "planned",
          velocityTarget: cs.velocityTarget,
          jiraIssues: [],
          claritySubtasks: cs.assignments.map((a) => ({
            subtaskId: a.subtask.id,
            ticketId: a.ticket.id,
            ticketTitle: a.ticket.title,
            title: a.subtask.title,
            storyPoints: a.subtask.storyPoints,
            jiraKey: a.subtask.jiraId,
            priority: a.subtask.priority,
          })),
        });
      }
    }
  } else {
    // No Jira: just use Clarity sprints
    for (const cs of claritySprints) {
      mergedSprints.push({
        jiraSprintId: null,
        claritySprintId: cs.id,
        name: cs.name,
        state: "planned",
        velocityTarget: cs.velocityTarget,
        jiraIssues: [],
        claritySubtasks: cs.assignments.map((a) => ({
          subtaskId: a.subtask.id,
          ticketId: a.ticket.id,
          ticketTitle: a.ticket.title,
          title: a.subtask.title,
          storyPoints: a.subtask.storyPoints,
          jiraKey: a.subtask.jiraId,
          priority: a.subtask.priority,
        })),
      });
    }
  }

  return NextResponse.json({
    hasJira: boardId !== null,
    boardId,
    sprints: mergedSprints,
    unplanned: unplannedSubtasks.map((s) => ({
      subtaskId: s.id,
      ticketId: s.ticket.id,
      ticketTitle: s.ticket.title,
      title: s.title,
      storyPoints: s.storyPoints,
      jiraKey: s.jiraId,
      priority: s.priority,
    })),
  });
}

// ── POST /api/projects/[projectId]/sprint-plan ────────────────────────────────
// Saves drag-and-drop changes: updates Clarity DB + moves issues in Jira.
const moveSchema = z.object({
  boardId: z.number().nullable(),
  moves: z.array(z.object({
    subtaskId: z.string(),
    targetSprintName: z.string(),
    targetJiraSprintId: z.number().nullable(),
    jiraKey: z.string().nullable(),
  })),
});

export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getProjectById(params.projectId, session.user.id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = moveSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Bad input" }, { status: 400 });

  const { boardId, moves } = parsed.data;

  // Update Clarity sprint assignments in DB
  for (const move of moves) {
    // Find or create the Clarity sprint with that name
    let sprint = await prisma.sprint.findFirst({
      where: { orgId: params.projectId, name: { equals: move.targetSprintName, mode: "insensitive" } },
    });
    if (!sprint) {
      const order = await prisma.sprint.count({ where: { orgId: params.projectId } });
      sprint = await prisma.sprint.create({
        data: {
          orgId: params.projectId,
          name: move.targetSprintName,
          goal: `${move.targetSprintName} work`,
          velocityTarget: 20,
          committedPoints: 0,
          order,
        },
      });
    }

    // Upsert the sprint assignment
    await prisma.sprintAssignment.upsert({
      where: { subtaskId: move.subtaskId },
      create: { subtaskId: move.subtaskId, sprintId: sprint.id, ticketId: (await prisma.subtask.findUnique({ where: { id: move.subtaskId }, select: { ticketId: true } }))!.ticketId },
      update: { sprintId: sprint.id },
    });
  }

  // Sync to Jira: group moves by target Jira sprint, then batch-assign
  if (boardId) {
    const byJiraSprint = new Map<number, string[]>(); // jiraSprintId → jiraKeys

    for (const move of moves) {
      if (!move.jiraKey) continue; // not yet pushed to Jira, skip
      let jiraSprintId = move.targetJiraSprintId;
      if (!jiraSprintId) {
        jiraSprintId = await getOrCreateJiraSprint(boardId, move.targetSprintName);
      }
      if (!jiraSprintId) continue;
      const keys = byJiraSprint.get(jiraSprintId) ?? [];
      keys.push(move.jiraKey);
      byJiraSprint.set(jiraSprintId, keys);
    }

    for (const [jiraSprintId, keys] of byJiraSprint) {
      await assignIssuesToJiraSprint(jiraSprintId, keys);
    }
  }

  return NextResponse.json({ ok: true });
}
