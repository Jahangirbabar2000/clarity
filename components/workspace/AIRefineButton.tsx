"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wand2 } from "lucide-react";

export function AIRefineButton({
  onSubmit,
  loading,
}: {
  onSubmit: (request: string) => void;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" title="AI refine">
          <Wand2 className="h-3.5 w-3.5" /> AI refine
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-2">
          <div className="text-xs font-medium">Tell Claude what to change</div>
          <Input
            autoFocus
            value={value}
            disabled={loading}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. make these more specific"
            onKeyDown={(e) => {
              if (e.key === "Enter" && value.trim()) {
                onSubmit(value.trim());
                setValue("");
                setOpen(false);
              }
            }}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={loading || !value.trim()}
              onClick={() => {
                onSubmit(value.trim());
                setValue("");
                setOpen(false);
              }}
            >
              Refine
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
