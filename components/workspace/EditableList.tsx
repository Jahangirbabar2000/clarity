"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { AIRefineButton } from "./AIRefineButton";

export function EditableList({
  label,
  items,
  onChange,
  onRefine,
  refining,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  onRefine?: (request: string) => void;
  refining?: boolean;
  placeholder?: string;
}) {
  const update = (i: number, value: string) => {
    const next = [...items];
    next[i] = value;
    onChange(next);
  };
  const add = () => onChange([...items, ""]);
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{label}</div>
        {onRefine ? <AIRefineButton onSubmit={onRefine} loading={refining} /> : null}
      </div>
      <div className="space-y-1.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => move(i, i - 1)}
                className="text-muted-foreground hover:text-foreground"
                title="Move up"
              >
                <GripVertical className="h-3 w-3 rotate-90" />
              </button>
            </div>
            <Input
              value={it}
              onChange={(e) => update(i, e.target.value)}
              placeholder={placeholder}
            />
            <Button variant="ghost" size="icon" onClick={() => remove(i)} title="Delete">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" onClick={add}>
        <Plus className="h-3.5 w-3.5" /> Add
      </Button>
    </div>
  );
}
