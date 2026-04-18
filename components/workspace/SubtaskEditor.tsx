"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { AIRefineButton } from "./AIRefineButton";
import type { Subtask } from "@/types/models";

export type SubtaskDraft = Pick<Subtask, "id" | "title" | "description" | "type" | "storyPoints" | "priority" | "dependsOn" | "order"> & {
  suggestedSprint?: number | null;
};

const TYPES = ["FRONTEND", "BACKEND", "DATABASE", "TESTING", "INFRA", "DEVOPS", "PM"] as const;
const PRIORITIES = ["HIGH", "MED", "LOW"] as const;

const TYPE_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "info" | "destructive"> = {
  FRONTEND: "info",
  BACKEND: "secondary",
  DATABASE: "warning",
  TESTING: "success",
  INFRA: "secondary",
  DEVOPS: "secondary",
  PM: "default",
};

export function SubtaskEditor({
  subtasks,
  onChange,
  onRefineAll,
  refiningAll,
}: {
  subtasks: SubtaskDraft[];
  onChange: (next: SubtaskDraft[]) => void;
  onRefineAll?: (req: string) => void;
  refiningAll?: boolean;
}) {
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = subtasks.findIndex((s) => s.id === active.id);
    const newIdx = subtasks.findIndex((s) => s.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(subtasks, oldIdx, newIdx).map((s, i) => ({ ...s, order: i }));
    onChange(reordered);
  };

  const update = (id: string, patch: Partial<SubtaskDraft>) => {
    onChange(subtasks.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };
  const remove = (id: string) => onChange(subtasks.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i })));
  const add = () => {
    const id = `new-${Date.now()}`;
    onChange([
      ...subtasks,
      {
        id,
        title: "New subtask",
        description: "",
        type: "BACKEND",
        storyPoints: 3,
        priority: "MED",
        dependsOn: [],
        order: subtasks.length,
        suggestedSprint: 1,
      },
    ]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Subtasks</h3>
          <p className="text-xs text-muted-foreground">{subtasks.length} items · {subtasks.reduce((sum, s) => sum + s.storyPoints, 0)} pts</p>
        </div>
        {onRefineAll ? <AIRefineButton onSubmit={onRefineAll} loading={refiningAll} /> : null}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={subtasks.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {subtasks.map((s) => (
              <SortableRow key={s.id} subtask={s} onChange={(p) => update(s.id, p)} onDelete={() => remove(s.id)} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Button size="sm" variant="outline" onClick={add}>
        <Plus className="h-3.5 w-3.5" /> Add subtask
      </Button>
    </div>
  );
}

function SortableRow({
  subtask,
  onChange,
  onDelete,
}: {
  subtask: SubtaskDraft;
  onChange: (patch: Partial<SubtaskDraft>) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: subtask.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="rounded-md border bg-card p-3">
      <div className="flex items-start gap-2">
        <button {...attributes} {...listeners} className="mt-2 cursor-grab text-muted-foreground hover:text-foreground">
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1 space-y-2">
          <Input
            value={subtask.title}
            onChange={(e) => onChange({ title: e.target.value })}
            className="h-8 font-medium"
            placeholder="Subtask title"
          />
          <Textarea
            value={subtask.description}
            onChange={(e) => onChange({ description: e.target.value })}
            rows={2}
            placeholder="1–2 sentences describing the work"
          />
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant={TYPE_VARIANT[subtask.type] ?? "secondary"}>{subtask.type}</Badge>
            <Select
              value={subtask.type}
              onChange={(v) => onChange({ type: v as SubtaskDraft["type"] })}
              options={TYPES.map((t) => ({ value: t, label: t }))}
              className="h-7 text-xs"
            />
            <Select
              value={subtask.priority}
              onChange={(v) => onChange({ priority: v as SubtaskDraft["priority"] })}
              options={PRIORITIES.map((p) => ({ value: p, label: `Priority: ${p}` }))}
              className="h-7 text-xs"
            />
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Points:</span>
              <Input
                type="number"
                min={1}
                max={13}
                value={subtask.storyPoints}
                onChange={(e) => onChange({ storyPoints: Math.max(1, Number(e.target.value || 1)) })}
                className="h-7 w-14 text-xs"
              />
            </div>
            <Button variant="ghost" size="icon" onClick={onDelete} className="ml-auto h-7 w-7">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
