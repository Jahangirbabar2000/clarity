import { describe, it, expect } from "vitest";
import { planSprints } from "./sprint-planner";
import type { Subtask } from "@prisma/client";

function sub(partial: Partial<Subtask> & Pick<Subtask, "id" | "title" | "storyPoints">): Subtask {
  return {
    ticketId: "t1",
    jiraId: null,
    jiraUrl: null,
    description: "",
    type: "BACKEND",
    priority: "MED",
    dependsOn: [],
    suggestedSprint: null,
    order: 0,
    ...partial,
  } as Subtask;
}

describe("planSprints", () => {
  it("packs independent subtasks into one sprint when velocity allows", () => {
    const subs = [
      sub({ id: "a", title: "A", storyPoints: 3 }),
      sub({ id: "b", title: "B", storyPoints: 5 }),
      sub({ id: "c", title: "C", storyPoints: 2 }),
    ];
    const sprints = planSprints(subs, 20, 2);
    expect(sprints).toHaveLength(1);
    expect(sprints[0].committedPoints).toBe(10);
    expect(sprints[0].subtasks.map((s) => s.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("splits across sprints when velocity cap is hit", () => {
    const subs = [
      sub({ id: "a", title: "A", storyPoints: 8 }),
      sub({ id: "b", title: "B", storyPoints: 8 }),
      sub({ id: "c", title: "C", storyPoints: 8 }),
    ];
    const sprints = planSprints(subs, 10, 2);
    expect(sprints.length).toBeGreaterThanOrEqual(3);
    for (const sp of sprints) {
      expect(sp.committedPoints).toBeLessThanOrEqual(10);
    }
    const all = sprints.flatMap((s) => s.subtasks.map((st) => st.id));
    expect(all.sort()).toEqual(["a", "b", "c"]);
  });

  it("respects dependsOn ordering across sprints", () => {
    const subs = [
      sub({ id: "child", title: "Child", storyPoints: 5, dependsOn: ["Parent"] }),
      sub({ id: "parent", title: "Parent", storyPoints: 5 }),
    ];
    const sprints = planSprints(subs, 5, 2);
    const parentSprint = sprints.findIndex((s) => s.subtasks.some((st) => st.id === "parent"));
    const childSprint = sprints.findIndex((s) => s.subtasks.some((st) => st.id === "child"));
    expect(parentSprint).toBeGreaterThanOrEqual(0);
    expect(childSprint).toBeGreaterThan(parentSprint);
  });

  it("keeps dependent items in the same sprint when velocity permits ordering", () => {
    const subs = [
      sub({ id: "p", title: "P", storyPoints: 2 }),
      sub({ id: "c", title: "C", storyPoints: 3, dependsOn: ["P"] }),
    ];
    const sprints = planSprints(subs, 20, 2);
    expect(sprints).toHaveLength(1);
    const order = sprints[0].subtasks.map((s) => s.id);
    expect(order.indexOf("p")).toBeLessThan(order.indexOf("c"));
  });

  it("schedules tasks whose dependsOn references a non-existent title (broken deps)", () => {
    const subs = [
      sub({ id: "orphan", title: "Orphan", storyPoints: 3, dependsOn: ["DoesNotExist"] }),
      sub({ id: "normal", title: "Normal", storyPoints: 2 }),
    ];
    const sprints = planSprints(subs, 20, 2);
    const all = sprints.flatMap((s) => s.subtasks.map((st) => st.id));
    expect(all).toContain("orphan");
    expect(all).toContain("normal");
  });

  it("handles empty subtask list", () => {
    const sprints = planSprints([], 20, 2);
    expect(sprints).toEqual([]);
  });

  it("labels sprints incrementally starting at Sprint 1", () => {
    const subs = [
      sub({ id: "a", title: "A", storyPoints: 10 }),
      sub({ id: "b", title: "B", storyPoints: 10 }),
    ];
    const sprints = planSprints(subs, 10, 2);
    expect(sprints[0].name).toBe("Sprint 1");
    expect(sprints[1].name).toBe("Sprint 2");
  });
});
