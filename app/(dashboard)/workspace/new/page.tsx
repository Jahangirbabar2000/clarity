"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IdeaInput } from "@/components/workspace/IdeaInput";
import { TicketEditor } from "@/components/workspace/TicketEditor";
import type { TicketWithRelations } from "@/types/models";
import type { ContextSummary } from "@/components/workspace/ContextPanel";

type Phase =
  | { name: "idle" }
  | { name: "building"; progress: string }
  | { name: "error"; message: string }
  | { name: "ready"; ticket: TicketWithRelations; context: ContextSummary };

export default function NewTicketPage() {
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const router = useRouter();

  const build = async (idea: string) => {
    setPhase({ name: "building", progress: "Connecting to Clarity…" });

    const res = await fetch("/api/workspace/build-ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea }),
    });

    if (!res.ok || !res.body) {
      setPhase({ name: "error", message: `Build failed (${res.status})` });
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let summary: ContextSummary | undefined;

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
        if (payload.phase === "context") {
          setPhase({ name: "building", progress: payload.message });
        } else if (payload.phase === "context_ready") {
          summary = {
            sources: payload.sources,
            techStack: payload.techStack,
            files: payload.files,
          };
          setPhase({ name: "building", progress: "Reviewing PRD, Notion and Jira history…" });
        } else if (payload.phase === "generating") {
          setPhase({ name: "building", progress: payload.message });
        } else if (payload.phase === "chunk") {
          setPhase((p) =>
            p.name === "building" ? { name: "building", progress: "Writing ticket…" } : p,
          );
        } else if (payload.phase === "done") {
          const ticket = {
            ...payload.ticket,
            sprintAssignments: [],
            subtasks: payload.ticket.subtasks.map((s: { sprintAssignment?: null } & Record<string, unknown>) => ({
              ...s,
              sprintAssignment: null,
            })),
          } as TicketWithRelations;
          setPhase({ name: "ready", ticket, context: summary ?? { sources: { github: true, jira: true, notion: false, prd: false, existingTickets: 0 } } });
          router.replace(`/workspace/${payload.ticketId}`);
          return;
        } else if (payload.phase === "error") {
          setPhase({ name: "error", message: payload.message });
          return;
        }
      }
    }
  };

  if (phase.name === "ready") {
    return <TicketEditor ticket={phase.ticket} contextSummary={phase.context} />;
  }

  return (
    <div className="py-10">
      <IdeaInput
        onSubmit={build}
        loading={phase.name === "building"}
        progress={phase.name === "building" ? phase.progress : undefined}
      />
      {phase.name === "error" ? (
        <div className="mx-auto mt-4 max-w-3xl rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {phase.message}
        </div>
      ) : null}
    </div>
  );
}
