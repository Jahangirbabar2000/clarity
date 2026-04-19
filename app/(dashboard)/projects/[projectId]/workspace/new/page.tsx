"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Github, BookOpen, FileText, Database } from "lucide-react";
import { IdeaInput } from "@/components/workspace/IdeaInput";
import { TicketEditor } from "@/components/workspace/TicketEditor";
import { AgentTimeline } from "@/components/workspace/AgentTimeline";
import type { TicketWithRelations } from "@/types/models";
import type { ContextSummary } from "@/components/workspace/ContextPanel";
import type { AgentEvent, CritiqueReport } from "@/types/agents";
import type { IntegrationStatus } from "@/types/api";

type Phase =
  | { name: "idle" }
  | { name: "building"; progress: string }
  | { name: "error"; message: string }
  | { name: "ready"; ticket: TicketWithRelations; context: ContextSummary; critique?: CritiqueReport };

export default function NewTicketPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);
  const router = useRouter();

  const { data: integrationsData } = useQuery<{ integrations: IntegrationStatus[] }>({
    queryKey: ["integrations", projectId],
    queryFn: async () => (await fetch(`/api/integrations?projectId=${projectId}`)).json(),
  });

  const { data: prdData } = useQuery<{ prds: { id: string }[] }>({
    queryKey: ["prds", projectId],
    queryFn: async () => (await fetch(`/api/integrations/prd?projectId=${projectId}`)).json(),
  });

  const isConnected = (type: IntegrationStatus["type"]) =>
    integrationsData?.integrations.some((i) => i.type === type && i.connected) ?? false;

  const sources = [
    { key: "github", label: "GitHub", icon: Github, connected: isConnected("GITHUB") },
    { key: "notion", label: "Notion", icon: BookOpen, connected: isConnected("NOTION") },
    { key: "prd", label: "PRD", icon: FileText, connected: (prdData?.prds?.length ?? 0) > 0 },
    { key: "jira", label: "Jira", icon: Database, connected: isConnected("JIRA") },
  ];

  const build = async (idea: string) => {
    setPhase({ name: "building", progress: "Connecting to Clarity…" });
    setAgentEvents([]);

    const res = await fetch("/api/workspace/build-ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea, orgId: projectId }),
    });

    if (!res.ok || !res.body) {
      setPhase({ name: "error", message: `Build failed (${res.status})` });
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let summary: ContextSummary | undefined;
    let critique: CritiqueReport | undefined;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const evt of events) {
        const line = evt.trim();
        if (!line.startsWith("data:")) continue;
        const payload = JSON.parse(line.slice(5).trim());

        if (payload.agent_event) {
          setAgentEvents((prev) => [...prev, payload.agent_event as AgentEvent]);
          continue;
        }

        if (payload.phase === "context") {
          setPhase({ name: "building", progress: payload.message });
        } else if (payload.phase === "context_ready") {
          summary = { sources: payload.sources, techStack: payload.techStack, files: payload.files };
          setPhase({ name: "building", progress: "Reviewing PRD, Notion and Jira history…" });
        } else if (payload.phase === "generating") {
          setPhase({ name: "building", progress: payload.message });
        } else if (payload.phase === "chunk") {
          setPhase((p) => p.name === "building" ? { name: "building", progress: "Writing ticket…" } : p);
        } else if (payload.phase === "done") {
          critique = payload.critique as CritiqueReport | undefined;
          const ticket = {
            ...payload.ticket,
            sprintAssignments: [],
            subtasks: payload.ticket.subtasks.map((s: { sprintAssignment?: null } & Record<string, unknown>) => ({ ...s, sprintAssignment: null })),
          } as TicketWithRelations;
          setPhase({ name: "ready", ticket, context: summary ?? { sources: { github: true, jira: true, notion: false, prd: false, existingTickets: 0 } }, critique });
          router.replace(`/projects/${projectId}/workspace/${payload.ticketId}`);
          return;
        } else if (payload.phase === "error") {
          setPhase({ name: "error", message: payload.message });
          return;
        }
      }
    }
  };

  if (phase.name === "ready") {
    return <TicketEditor ticket={phase.ticket} contextSummary={phase.context} critique={phase.critique} />;
  }

  return (
    <div className="py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <IdeaInput onSubmit={build} loading={phase.name === "building"} progress={phase.name === "building" ? phase.progress : undefined} sources={sources} />
        {agentEvents.length > 0 && <AgentTimeline events={agentEvents} title="Multi-agent pipeline" subtitle="Context → Writer → Critic (↻ reflection)" />}
        {phase.name === "error" && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{phase.message}</div>}
      </div>
    </div>
  );
}
