"use client";

import { DndContext, PointerSensor, useDroppable, useDraggable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Wand2 } from "lucide-react";
import type { SubtaskDraft } from "./SubtaskEditor";

export type SprintBucket = { id: number; name: string; velocityTarget: number };

const DEFAULT_BUCKETS: SprintBucket[] = [
  { id: 1, name: "Sprint 1", velocityTarget: 20 },
  { id: 2, name: "Sprint 2", velocityTarget: 20 },
  { id: 3, name: "Sprint 3", velocityTarget: 20 },
];

export function SprintAssigner({
  subtasks,
  onChange,
  onAutoAssign,
  autoAssigning,
  buckets = DEFAULT_BUCKETS,
}: {
  subtasks: SubtaskDraft[];
  onChange: (next: SubtaskDraft[]) => void;
  onAutoAssign?: () => void;
  autoAssigning?: boolean;
  buckets?: SprintBucket[];
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const subtaskId = String(e.active.id);
    const sprintId = e.over ? Number(String(e.over.id).replace("sprint-", "")) : null;
    if (!sprintId) return;
    onChange(subtasks.map((s) => (s.id === subtaskId ? { ...s, suggestedSprint: sprintId } : s)));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Sprint plan</h3>
        {onAutoAssign ? (
          <Button size="sm" variant="outline" onClick={onAutoAssign} disabled={autoAssigning}>
            <Wand2 className="h-3.5 w-3.5" />
            {autoAssigning ? "Planning…" : "Auto-assign"}
          </Button>
        ) : null}
      </div>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="grid gap-2 md:grid-cols-3">
          {buckets.map((b) => {
            const inSprint = subtasks.filter((s) => (s.suggestedSprint ?? 1) === b.id);
            const points = inSprint.reduce((sum, s) => sum + s.storyPoints, 0);
            const pct = Math.min(100, Math.round((points / b.velocityTarget) * 100));
            const over = points > b.velocityTarget;
            return (
              <DroppableSprint key={b.id} id={`sprint-${b.id}`}>
                <Card className={cn(over && "border-red-300")}>
                  <CardHeader className="gap-1 pb-2">
                    <CardTitle className="flex items-center justify-between text-sm">
                      {b.name}
                      <Badge variant={over ? "destructive" : "secondary"}>
                        {points} / {b.velocityTarget} pts
                      </Badge>
                    </CardTitle>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className={cn("h-full", over ? "bg-red-500" : "bg-emerald-500")} style={{ width: `${pct}%` }} />
                    </div>
                  </CardHeader>
                  <CardContent className="min-h-[120px] space-y-1.5">
                    {inSprint.length === 0 ? (
                      <div className="rounded-md border border-dashed py-4 text-center text-xs text-muted-foreground">
                        Drop subtasks here
                      </div>
                    ) : (
                      inSprint.map((s) => <DraggableChip key={s.id} subtask={s} />)
                    )}
                  </CardContent>
                </Card>
              </DroppableSprint>
            );
          })}
        </div>
      </DndContext>
    </div>
  );
}

function DroppableSprint({ id, children }: { id: string; children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={cn(isOver && "rounded-lg ring-2 ring-primary/40")}>
      {children}
    </div>
  );
}

function DraggableChip({ subtask }: { subtask: SubtaskDraft }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: subtask.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ transform: transform ? `translate3d(${transform.x}px,${transform.y}px,0)` : undefined }}
      className={cn(
        "flex cursor-grab items-center justify-between gap-2 rounded-md border bg-background px-2 py-1.5 text-xs active:cursor-grabbing",
        isDragging && "opacity-60 shadow-md",
      )}
    >
      <span className="truncate">{subtask.title}</span>
      <Badge variant="outline" className="shrink-0">{subtask.storyPoints}</Badge>
    </div>
  );
}
