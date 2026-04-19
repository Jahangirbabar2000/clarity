"use client";

import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Layers, Ticket, Loader2, Check, AlertCircle, ExternalLink } from "lucide-react";

type ClaritySubtask = {
  subtaskId: string;
  ticketId: string;
  ticketTitle: string;
  title: string;
  storyPoints: number;
  jiraKey: string | null;
  priority: string;
};

type JiraIssue = {
  key: string;
  title: string;
  storyPoints: number | null;
  issueType: string;
  status: string;
};

type SprintColumn = {
  jiraSprintId: number | null;
  claritySprintId: string | null;
  name: string;
  state: string;
  velocityTarget: number;
  jiraIssues: JiraIssue[];
  claritySubtasks: ClaritySubtask[];
};

type SprintPlan = {
  hasJira: boolean;
  boardId: number | null;
  sprints: SprintColumn[];
  unplanned: ClaritySubtask[];
};

type PendingMove = {
  subtaskId: string;
  targetSprintName: string;
  targetJiraSprintId: number | null;
  jiraKey: string | null;
};

const UNPLANNED_ID = "__unplanned__";

export default function SprintsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const qc = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Local optimistic state on top of server data
  const [localSprints, setLocalSprints] = useState<SprintColumn[] | null>(null);
  const [localUnplanned, setLocalUnplanned] = useState<ClaritySubtask[] | null>(null);
  const [pendingMoves, setPendingMoves] = useState<PendingMove[]>([]);
  const [dragActive, setDragActive] = useState(false);

  const { data, isLoading, error } = useQuery<SprintPlan>({
    queryKey: ["sprint-plan", projectId],
    queryFn: (): Promise<SprintPlan> =>
      fetch(`/api/projects/${projectId}/sprint-plan`).then((r) => r.json()),
  });

  // Sync fresh server data into local state (reset local overrides when server data arrives)
  useEffect(() => {
    if (data) {
      setLocalSprints(data.sprints);
      setLocalUnplanned(data.unplanned);
      setPendingMoves([]);
    }
  }, [data]);

  const sprints: SprintColumn[] = localSprints ?? data?.sprints ?? [];
  const unplanned: ClaritySubtask[] = localUnplanned ?? data?.unplanned ?? [];
  const hasJira = data?.hasJira ?? false;
  const boardId = data?.boardId ?? null;

  const saveToJira = useMutation({
    mutationFn: () =>
      fetch(`/api/projects/${projectId}/sprint-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId, moves: pendingMoves }),
      }).then((r) => r.json()),
    onSuccess: () => {
      setPendingMoves([]);
      qc.invalidateQueries({ queryKey: ["sprint-plan", projectId] });
    },
  });

  const findSubtask = useCallback(
    (subtaskId: string): ClaritySubtask | undefined => {
      for (const s of sprints) {
        const found = s.claritySubtasks.find((t) => t.subtaskId === subtaskId);
        if (found) return found;
      }
      return unplanned.find((t) => t.subtaskId === subtaskId);
    },
    [sprints, unplanned],
  );

  const onDragStart = (_e: DragStartEvent) => setDragActive(true);

  const onDragEnd = (e: DragEndEvent) => {
    setDragActive(false);
    const subtaskId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;

    const subtask = findSubtask(subtaskId);
    if (!subtask) return;

    const targetSprintName = overId === UNPLANNED_ID ? null : overId;

    // Update local state optimistically
    setLocalSprints((prev) => {
      if (!prev) return prev;
      return prev.map((sp) => {
        if (sp.name === targetSprintName) {
          // Add to target sprint (avoid duplicates)
          if (sp.claritySubtasks.some((t) => t.subtaskId === subtaskId)) return sp;
          return { ...sp, claritySubtasks: [...sp.claritySubtasks, subtask] };
        }
        // Remove from any other sprint
        return { ...sp, claritySubtasks: sp.claritySubtasks.filter((t) => t.subtaskId !== subtaskId) };
      });
    });

    setLocalUnplanned((prev) => {
      if (!prev) return prev;
      if (overId === UNPLANNED_ID) {
        if (prev.some((t) => t.subtaskId === subtaskId)) return prev;
        return [...prev, subtask];
      }
      return prev.filter((t) => t.subtaskId !== subtaskId);
    });

    if (targetSprintName) {
      const targetSprint = sprints.find((s) => s.name === targetSprintName);
      setPendingMoves((prev) => {
        const filtered = prev.filter((m) => m.subtaskId !== subtaskId);
        return [
          ...filtered,
          {
            subtaskId,
            targetSprintName,
            targetJiraSprintId: targetSprint?.jiraSprintId ?? null,
            jiraKey: subtask.jiraKey,
          },
        ];
      });
    } else {
      // Moved to unplanned — remove any pending move
      setPendingMoves((prev) => prev.filter((m) => m.subtaskId !== subtaskId));
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading sprint plan…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-destructive">
        <AlertCircle className="h-6 w-6" />
        <p className="text-sm">Failed to load sprint plan.</p>
      </div>
    );
  }

  const allEmpty = sprints.length === 0 && unplanned.length === 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-xl font-bold">Sprint Board</h1>
          <p className="text-xs text-muted-foreground">
            {hasJira ? "Synced with Jira · " : ""}
            Drag subtasks between sprints · Click Save to push changes
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pendingMoves.length > 0 && (
            <span className="text-xs text-amber-600 font-medium">
              {pendingMoves.length} unsaved change{pendingMoves.length !== 1 ? "s" : ""}
            </span>
          )}
          <Button
            size="sm"
            onClick={() => saveToJira.mutate()}
            disabled={pendingMoves.length === 0 || saveToJira.isPending}
          >
            {saveToJira.isPending ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
            ) : saveToJira.isSuccess && pendingMoves.length === 0 ? (
              <><Check className="h-3.5 w-3.5" /> Saved</>
            ) : (
              "Save to Jira"
            )}
          </Button>
        </div>
      </div>

      {allEmpty ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <Layers className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-medium">No sprint plan yet</p>
            <p className="text-sm text-muted-foreground">
              Open a ticket and click &ldquo;Add to Sprint Plan&rdquo; to get started.
            </p>
          </div>
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="flex flex-1 gap-4 overflow-x-auto p-6">
            {/* Sprint columns */}
            {sprints.map((sprint) => (
              <SprintCol key={sprint.name} sprint={sprint} dragActive={dragActive} />
            ))}

            {/* Unplanned column */}
            {unplanned.length > 0 || dragActive ? (
              <UnplannedCol subtasks={unplanned} dragActive={dragActive} />
            ) : null}
          </div>
        </DndContext>
      )}
    </div>
  );
}

function SprintCol({ sprint, dragActive }: { sprint: SprintColumn; dragActive: boolean }) {
  const { isOver, setNodeRef } = useDroppable({ id: sprint.name });
  const clarityPoints = sprint.claritySubtasks.reduce((s, t) => s + t.storyPoints, 0);
  const jiraPoints = sprint.jiraIssues.reduce((s, i) => s + (i.storyPoints ?? 0), 0);
  const total = clarityPoints + jiraPoints;
  const over = total > sprint.velocityTarget;
  const pct = Math.min(100, Math.round((total / Math.max(sprint.velocityTarget, 1)) * 100));

  // Group clarity subtasks by parent ticket
  const byTicket = new Map<string, { title: string; id: string; subtasks: ClaritySubtask[] }>();
  for (const s of sprint.claritySubtasks) {
    const entry = byTicket.get(s.ticketId) ?? { title: s.ticketTitle, id: s.ticketId, subtasks: [] };
    entry.subtasks.push(s);
    byTicket.set(s.ticketId, entry);
  }

  return (
    <div ref={setNodeRef} className={cn("flex w-72 shrink-0 flex-col rounded-lg", isOver && dragActive && "ring-2 ring-primary/50")}>
      {/* Column header */}
      <div className={cn("rounded-t-lg border border-b-0 bg-card px-3 py-2.5", over && "border-red-300")}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold">{sprint.name}</span>
            {sprint.state === "active" && (
              <Badge variant="default" className="text-[10px] px-1.5 py-0">Active</Badge>
            )}
            {sprint.state === "planned" && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Planned</Badge>
            )}
          </div>
          <Badge variant={over ? "destructive" : "secondary"} className="text-[10px]">
            {total} / {sprint.velocityTarget} pts
          </Badge>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className={over ? "h-full bg-red-500" : "h-full bg-emerald-500"} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Column body */}
      <div className={cn("flex flex-1 flex-col gap-2 rounded-b-lg border bg-muted/20 p-2", over && "border-red-300", isOver && dragActive && "bg-primary/5")}>
        {/* Jira-native issues (read-only, greyed) */}
        {sprint.jiraIssues.map((issue) => (
          <div key={issue.key} className="flex items-center justify-between gap-2 rounded-md border border-dashed bg-background/60 px-2.5 py-1.5 text-xs text-muted-foreground">
            <span className="truncate">{issue.title}</span>
            <div className="flex shrink-0 items-center gap-1">
              {issue.storyPoints != null && <Badge variant="outline" className="text-[10px]">{issue.storyPoints}</Badge>}
              <ExternalLink className="h-3 w-3" />
            </div>
          </div>
        ))}

        {/* Clarity subtasks grouped by ticket (draggable) */}
        {Array.from(byTicket.values()).map((group) => (
          <div key={group.id} className="space-y-1">
            <div className="flex items-center gap-1 px-0.5 text-[10px] font-medium text-muted-foreground">
              <Ticket className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{group.title}</span>
            </div>
            {group.subtasks.map((s) => (
              <DraggableSubtask key={s.subtaskId} subtask={s} />
            ))}
          </div>
        ))}

        {sprint.jiraIssues.length === 0 && sprint.claritySubtasks.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">
            Drop subtasks here
          </div>
        )}
      </div>
    </div>
  );
}

function UnplannedCol({ subtasks, dragActive }: { subtasks: ClaritySubtask[]; dragActive: boolean }) {
  const { isOver, setNodeRef } = useDroppable({ id: UNPLANNED_ID });
  const byTicket = new Map<string, { title: string; id: string; subtasks: ClaritySubtask[] }>();
  for (const s of subtasks) {
    const entry = byTicket.get(s.ticketId) ?? { title: s.ticketTitle, id: s.ticketId, subtasks: [] };
    entry.subtasks.push(s);
    byTicket.set(s.ticketId, entry);
  }

  return (
    <div ref={setNodeRef} className={cn("flex w-72 shrink-0 flex-col rounded-lg", isOver && dragActive && "ring-2 ring-primary/50")}>
      <div className="rounded-t-lg border border-b-0 bg-card px-3 py-2.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-muted-foreground">Unplanned</span>
          <Badge variant="outline" className="text-[10px]">{subtasks.length} subtasks</Badge>
        </div>
      </div>
      <div className={cn("flex flex-1 flex-col gap-2 rounded-b-lg border bg-muted/20 p-2", isOver && dragActive && "bg-primary/5")}>
        {subtasks.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">
            Drop here to unplan
          </div>
        ) : (
          Array.from(byTicket.values()).map((group) => (
            <div key={group.id} className="space-y-1">
              <div className="flex items-center gap-1 px-0.5 text-[10px] font-medium text-muted-foreground">
                <Ticket className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{group.title}</span>
              </div>
              {group.subtasks.map((s) => (
                <DraggableSubtask key={s.subtaskId} subtask={s} />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function DraggableSubtask({ subtask }: { subtask: ClaritySubtask }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: subtask.subtaskId });
  const priorityColor = subtask.priority === "HIGH" ? "text-red-600" : subtask.priority === "LOW" ? "text-blue-500" : "text-amber-500";

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ transform: transform ? `translate3d(${transform.x}px,${transform.y}px,0)` : undefined }}
      className={cn(
        "flex cursor-grab items-center justify-between gap-2 rounded-md border bg-background px-2.5 py-1.5 text-xs active:cursor-grabbing select-none",
        isDragging && "opacity-50 shadow-lg",
        subtask.jiraKey && "border-l-2 border-l-blue-400",
      )}
    >
      <span className="truncate">{subtask.title}</span>
      <div className="flex shrink-0 items-center gap-1">
        <span className={cn("text-[10px] font-medium", priorityColor)}>{subtask.priority}</span>
        <Badge variant="outline" className="text-[10px]">{subtask.storyPoints}</Badge>
      </div>
    </div>
  );
}
