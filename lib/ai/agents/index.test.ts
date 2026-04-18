import { describe, it, expect } from "vitest";
import {
  AGENT_REGISTRY,
  contextAgent,
  ticketWriterAgent,
  criticAgent,
  refinerAgent,
  sprintPlannerAgent,
  healthAnalystAgent,
} from "./index";

describe("AGENT_REGISTRY", () => {
  it("includes all six named agents in stable order", () => {
    expect(AGENT_REGISTRY.map((a) => a.name)).toEqual([
      "ContextAgent",
      "TicketWriterAgent",
      "CriticAgent",
      "RefinerAgent",
      "SprintPlannerAgent",
      "HealthAnalystAgent",
    ]);
  });

  it("every entry has a role string", () => {
    for (const a of AGENT_REGISTRY) {
      expect(typeof a.role).toBe("string");
      expect(a.role.length).toBeGreaterThan(0);
    }
  });

  it("only the SprintPlannerAgent is deterministic (task === null)", () => {
    const deterministic = AGENT_REGISTRY.filter((a) => a.task === null).map((a) => a.name);
    expect(deterministic).toEqual(["SprintPlannerAgent"]);
  });

  it("agents exported directly match entries in the registry", () => {
    const directNames = [
      contextAgent.name,
      ticketWriterAgent.name,
      criticAgent.name,
      refinerAgent.name,
      sprintPlannerAgent.name,
      healthAnalystAgent.name,
    ].sort();
    const registryNames = AGENT_REGISTRY.map((a) => a.name).sort();
    expect(directNames).toEqual(registryNames);
  });
});
