import type { Subtask } from "@prisma/client";

export type PlannedSprint = {
  order: number;
  name: string;
  goal: string;
  velocityTarget: number;
  committedPoints: number;
  subtasks: Subtask[];
};

/**
 * Greedy topological pack: preserves dependsOn order and respects velocity cap.
 * No AI call required — deterministic, explainable, fast.
 */
export function planSprints(
  subtasks: Subtask[],
  velocityPerSprint: number,
  sprintLengthWeeks: number,
): PlannedSprint[] {
  const byTitle = new Map(subtasks.map((s) => [s.title, s]));
  const indegree = new Map<string, number>();
  const ready: Subtask[] = [];

  for (const s of subtasks) {
    const blocking = s.dependsOn.filter((t) => byTitle.has(t)).length;
    indegree.set(s.id, blocking);
    if (blocking === 0) ready.push(s);
  }

  const sprints: PlannedSprint[] = [];
  let sprintIdx = 0;
  let current: PlannedSprint = makeSprint(sprintIdx++, velocityPerSprint, sprintLengthWeeks);
  const scheduled = new Set<string>();

  const tryPack = (s: Subtask) => {
    if (current.committedPoints + s.storyPoints > current.velocityTarget && current.subtasks.length > 0) {
      sprints.push(current);
      current = makeSprint(sprintIdx++, velocityPerSprint, sprintLengthWeeks);
    }
    current.subtasks.push(s);
    current.committedPoints += s.storyPoints;
    scheduled.add(s.id);
  };

  while (ready.length > 0) {
    ready.sort((a, b) => b.storyPoints - a.storyPoints);
    const next = ready.shift()!;
    tryPack(next);

    for (const child of subtasks) {
      if (scheduled.has(child.id)) continue;
      const blockers = child.dependsOn.map((t) => byTitle.get(t)).filter((b): b is Subtask => Boolean(b));
      const unresolved = blockers.filter((b) => !scheduled.has(b.id)).length;
      indegree.set(child.id, unresolved);
      if (unresolved === 0 && !ready.find((r) => r.id === child.id)) ready.push(child);
    }
  }

  // Any with broken deps — append.
  for (const s of subtasks) if (!scheduled.has(s.id)) tryPack(s);
  if (current.subtasks.length > 0) sprints.push(current);

  return sprints;
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
