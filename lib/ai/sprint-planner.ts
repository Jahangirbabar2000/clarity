import type { Subtask, Sprint } from "@prisma/client";

export type PlannedSprint = {
  order: number;
  name: string;
  goal: string;
  velocityTarget: number;
  committedPoints: number;
  subtasks: Subtask[];
};

export type ExistingSprintSlot = {
  id: string;
  order: number;
  name: string;
  velocityTarget: number;
  committedPoints: number;
};

/**
 * Greedy topological pack across ALL subtasks from all tickets.
 * Fills existing sprint capacity first, then creates new sprints.
 */
export function planSprintsForProject(
  allSubtasks: Subtask[],
  existingSprints: ExistingSprintSlot[],
  velocityPerSprint: number,
  sprintLengthWeeks: number,
): PlannedSprint[] {
  const byTitle = new Map(allSubtasks.map((s) => [s.title, s]));
  const ready: Subtask[] = [];

  for (const s of allSubtasks) {
    const blocking = s.dependsOn.filter((t) => byTitle.has(t)).length;
    if (blocking === 0) ready.push(s);
  }

  // Seed from existing sprints (carry over their used capacity)
  const sprints: PlannedSprint[] = existingSprints
    .sort((a, b) => a.order - b.order)
    .map((s) => ({
      order: s.order,
      name: s.name,
      goal: `Ship planned work — ${sprintLengthWeeks}-week cycle`,
      velocityTarget: s.velocityTarget,
      committedPoints: s.committedPoints,
      subtasks: [],
    }));

  let sprintIdx = sprints.length;
  const addSprint = () => {
    const s = makeSprint(sprintIdx++, velocityPerSprint, sprintLengthWeeks);
    sprints.push(s);
    return s;
  };

  const scheduled = new Set<string>();

  const tryPack = (s: Subtask) => {
    // Find first sprint with remaining capacity
    let target = sprints.find((sp) => sp.committedPoints + s.storyPoints <= sp.velocityTarget);
    if (!target) target = addSprint();
    target.subtasks.push(s);
    target.committedPoints += s.storyPoints;
    scheduled.add(s.id);
  };

  while (ready.length > 0) {
    ready.sort((a, b) => b.storyPoints - a.storyPoints);
    const next = ready.shift()!;
    tryPack(next);

    for (const child of allSubtasks) {
      if (scheduled.has(child.id)) continue;
      const blockers = child.dependsOn.map((t) => byTitle.get(t)).filter((b): b is Subtask => Boolean(b));
      const unresolved = blockers.filter((b) => !scheduled.has(b.id)).length;
      if (unresolved === 0 && !ready.find((r) => r.id === child.id)) ready.push(child);
    }
  }

  for (const s of allSubtasks) if (!scheduled.has(s.id)) tryPack(s);

  return sprints.filter((s) => s.subtasks.length > 0 || existingSprints.some((e) => e.order === s.order));
}

/** Legacy single-ticket planner kept for backwards compatibility. */
export function planSprints(
  subtasks: Subtask[],
  velocityPerSprint: number,
  sprintLengthWeeks: number,
): PlannedSprint[] {
  return planSprintsForProject(subtasks, [], velocityPerSprint, sprintLengthWeeks);
}

function makeSprint(order: number, velocity: number, weeks: number): PlannedSprint {
  return {
    order,
    name: `Sprint ${order + 1}`,
    goal: `Ship planned work — ${weeks}-week cycle`,
    velocityTarget: velocity,
    committedPoints: 0,
    subtasks: [],
  };
}
