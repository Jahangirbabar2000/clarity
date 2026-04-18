"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { EditableList } from "./EditableList";
import { AIRefineButton } from "./AIRefineButton";
import { SubtaskEditor, type SubtaskDraft } from "./SubtaskEditor";
import { SprintAssigner } from "./SprintAssigner";
import { ContextPanel, type ContextSummary } from "./ContextPanel";
import { PushToJiraButton } from "./PushToJiraButton";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/utils";
import { useAutoSaveTicket } from "@/lib/hooks/useAutoSaveTicket";
import type { TicketWithRelations } from "@/types/models";
import { Loader2, Check, AlertCircle } from "lucide-react";

type Priority = "HIGH" | "MED" | "LOW";
type TicketType = "FEATURE" | "BUG" | "IMPROVEMENT" | "SPIKE";

type Draft = {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  edgeCases: string[];
  outOfScope: string[];
  type: TicketType;
  priority: Priority;
  storyPoints: number | null;
  status: "DRAFT" | "REVIEWED" | "PUSHED";
  subtasks: SubtaskDraft[];
};

function fromTicket(t: TicketWithRelations): Draft {
  return {
    title: t.title,
    description: t.description,
    acceptanceCriteria: t.acceptanceCriteria,
    edgeCases: t.edgeCases,
    outOfScope: t.outOfScope,
    type: t.type as TicketType,
    priority: t.priority as Priority,
    storyPoints: t.storyPoints,
    status: t.status as Draft["status"],
    subtasks: t.subtasks.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      type: s.type as SubtaskDraft["type"],
      storyPoints: s.storyPoints,
      priority: s.priority as Priority,
      dependsOn: s.dependsOn,
      order: s.order,
      suggestedSprint: s.suggestedSprint ?? 1,
    })),
  };
}

export function TicketEditor({
  ticket,
  contextSummary,
}: {
  ticket: TicketWithRelations;
  contextSummary?: ContextSummary;
}) {
  const [draft, setDraft] = useState<Draft>(() => fromTicket(ticket));
  const [refiningField, setRefiningField] = useState<string | null>(null);

  const { status: saveStatus, lastSavedAt } = useAutoSaveTicket(
    ticket.id,
    draft,
    (d) => ({
      title: d.title,
      description: d.description,
      acceptanceCriteria: d.acceptanceCriteria,
      edgeCases: d.edgeCases,
      outOfScope: d.outOfScope,
      type: d.type,
      priority: d.priority,
      storyPoints: d.storyPoints,
      status: d.status,
      subtasks: d.subtasks.map((s, i) => ({
        id: s.id.startsWith("new-") ? undefined : s.id,
        title: s.title,
        description: s.description,
        type: s.type,
        storyPoints: s.storyPoints,
        priority: s.priority,
        dependsOn: s.dependsOn,
        suggestedSprint: s.suggestedSprint ?? null,
        order: i,
      })),
    }),
  );

  const refine = async (field: string, editRequest: string) => {
    setRefiningField(field);
    try {
      const r = await fetch("/api/workspace/refine-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: ticket.id, field, editRequest }),
      });
      const data = await r.json();
      if (!data || !("value" in data)) return;

      setDraft((prev) => {
        if (field === "title" || field === "description") {
          return { ...prev, [field]: String(data.value) };
        }
        if (["acceptanceCriteria", "edgeCases", "outOfScope"].includes(field) && Array.isArray(data.value)) {
          return { ...prev, [field]: data.value as string[] };
        }
        if (field === "subtasks" && Array.isArray(data.value)) {
          return {
            ...prev,
            subtasks: (data.value as SubtaskDraft[]).map((s, i) => ({
              ...s,
              id: `new-${Date.now()}-${i}`,
              order: i,
              suggestedSprint: s.suggestedSprint ?? 1,
              dependsOn: s.dependsOn ?? [],
            })),
          };
        }
        return prev;
      });
    } finally {
      setRefiningField(null);
    }
  };

  const autoAssign = async () => {
    setRefiningField("sprints");
    try {
      const r = await fetch("/api/workspace/build-sprint-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: ticket.id, velocityPerSprint: 20, sprintLengthWeeks: 2 }),
      });
      const data = await r.json();
      if (data.sprints) {
        const map = new Map<string, number>();
        for (const sp of data.sprints as Array<{ order: number; subtasks: Array<{ id: string }> }>) {
          for (const st of sp.subtasks) map.set(st.id, sp.order + 1);
        }
        setDraft((prev) => ({
          ...prev,
          subtasks: prev.subtasks.map((s) => ({ ...s, suggestedSprint: map.get(s.id) ?? s.suggestedSprint ?? 1 })),
        }));
      }
    } finally {
      setRefiningField(null);
    }
  };

  return (
    <div className="space-y-4 pb-24">
      {contextSummary ? <ContextPanel summary={contextSummary} /> : null}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <Card>
            <CardHeader className="gap-3 pb-3">
              <div className="flex items-center gap-2">
                <Input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className="h-11 border-0 bg-transparent px-0 text-xl font-semibold shadow-none focus-visible:ring-0"
                />
                <AIRefineButton onSubmit={(r) => refine("title", r)} loading={refiningField === "title"} />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Select
                  value={draft.type}
                  onChange={(v) => setDraft({ ...draft, type: v as TicketType })}
                  options={[
                    { value: "FEATURE", label: "FEATURE" },
                    { value: "BUG", label: "BUG" },
                    { value: "IMPROVEMENT", label: "IMPROVEMENT" },
                    { value: "SPIKE", label: "SPIKE" },
                  ]}
                />
                <Select
                  value={draft.priority}
                  onChange={(v) => setDraft({ ...draft, priority: v as Priority })}
                  options={[
                    { value: "HIGH", label: "Priority: HIGH" },
                    { value: "MED", label: "Priority: MED" },
                    { value: "LOW", label: "Priority: LOW" },
                  ]}
                />
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Points</span>
                  <Input
                    type="number"
                    value={draft.storyPoints ?? 0}
                    onChange={(e) => setDraft({ ...draft, storyPoints: Number(e.target.value) || null })}
                    className="h-8 w-16"
                  />
                </div>
                {ticket.suggestedLabels?.length ? (
                  <div className="flex flex-wrap gap-1">
                    {ticket.suggestedLabels.map((l) => <Badge key={l} variant="outline">{l}</Badge>)}
                  </div>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-medium">Description</div>
                  <AIRefineButton onSubmit={(r) => refine("description", r)} loading={refiningField === "description"} />
                </div>
                <Textarea
                  rows={10}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </div>
              <EditableList
                label="Acceptance criteria"
                items={draft.acceptanceCriteria}
                onChange={(v) => setDraft({ ...draft, acceptanceCriteria: v })}
                onRefine={(r) => refine("acceptanceCriteria", r)}
                refining={refiningField === "acceptanceCriteria"}
                placeholder="Given / When / Then"
              />
              <EditableList
                label="Edge cases"
                items={draft.edgeCases}
                onChange={(v) => setDraft({ ...draft, edgeCases: v })}
                onRefine={(r) => refine("edgeCases", r)}
                refining={refiningField === "edgeCases"}
                placeholder="What could go wrong?"
              />
              <EditableList
                label="Out of scope"
                items={draft.outOfScope}
                onChange={(v) => setDraft({ ...draft, outOfScope: v })}
                onRefine={(r) => refine("outOfScope", r)}
                refining={refiningField === "outOfScope"}
                placeholder="Explicitly not in this ticket"
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardContent className="space-y-4 p-5">
              <SubtaskEditor
                subtasks={draft.subtasks}
                onChange={(next) => setDraft({ ...draft, subtasks: next })}
                onRefineAll={(r) => refine("subtasks", r)}
                refiningAll={refiningField === "subtasks"}
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <SprintAssigner
                subtasks={draft.subtasks}
                onChange={(next) => setDraft({ ...draft, subtasks: next })}
                onAutoAssign={autoAssign}
                autoAssigning={refiningField === "sprints"}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <StickyBar status={draft.status} saveStatus={saveStatus} lastSavedAt={lastSavedAt} ticket={ticket} subtaskCount={draft.subtasks.length} onStatusChange={(s) => setDraft({ ...draft, status: s })} />
    </div>
  );
}

function StickyBar({
  status,
  saveStatus,
  lastSavedAt,
  ticket,
  subtaskCount,
  onStatusChange,
}: {
  status: "DRAFT" | "REVIEWED" | "PUSHED";
  saveStatus: "idle" | "saving" | "saved" | "error";
  lastSavedAt: Date | null;
  ticket: TicketWithRelations;
  subtaskCount: number;
  onStatusChange: (s: "DRAFT" | "REVIEWED" | "PUSHED") => void;
}) {
  const variant = status === "PUSHED" ? "success" : status === "REVIEWED" ? "info" : "secondary";
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-4 border-t bg-background/95 px-4 py-3 backdrop-blur md:left-56">
      <div className="flex items-center gap-3 text-xs">
        <Badge variant={variant}>{status}</Badge>
        {status !== "PUSHED" ? (
          <Button variant="ghost" size="sm" onClick={() => onStatusChange(status === "DRAFT" ? "REVIEWED" : "DRAFT")}>
            {status === "DRAFT" ? "Mark reviewed" : "Revert to draft"}
          </Button>
        ) : null}
        <SaveIndicator status={saveStatus} at={lastSavedAt} />
      </div>
      <div>
        <PushToJiraButton
          ticketId={ticket.id}
          subtaskCount={subtaskCount}
          alreadyPushed={ticket.status === "PUSHED"}
          jiraUrl={ticket.jiraUrl}
        />
      </div>
    </div>
  );
}

function SaveIndicator({ status, at }: { status: "idle" | "saving" | "saved" | "error"; at: Date | null }) {
  if (status === "saving") return <span className="flex items-center gap-1 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Saving…</span>;
  if (status === "error") return <span className="flex items-center gap-1 text-red-600"><AlertCircle className="h-3 w-3" /> Save failed</span>;
  if (status === "saved" || at) return <span className="flex items-center gap-1 text-muted-foreground"><Check className="h-3 w-3" /> Saved {formatRelative(at)}</span>;
  return null;
}
