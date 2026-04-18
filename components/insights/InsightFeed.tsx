"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InsightCard } from "./InsightCard";
import { Sparkles } from "lucide-react";
import type { AIInsight } from "@/types/models";

export function InsightFeed({ limit = 20, compact = false }: { limit?: number; compact?: boolean }) {
  const qc = useQueryClient();

  const list = useQuery<{ insights: AIInsight[] }>({
    queryKey: ["insights", limit],
    queryFn: async () => {
      const r = await fetch(`/api/insights/generate?limit=${limit}`);
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
  });

  const gen = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/insights/generate", { method: "POST", body: JSON.stringify({}) });
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["insights"] }),
  });

  if (list.isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
      </div>
    );
  }

  const items = (list.data?.insights ?? []).slice(0, limit);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-md border border-dashed p-6 text-center">
        <div className="text-sm text-muted-foreground">No AI insights yet for this org.</div>
        <Button size="sm" onClick={() => gen.mutate()} disabled={gen.isPending}>
          <Sparkles className="h-4 w-4" />
          {gen.isPending ? "Analyzing metrics…" : "Generate insights"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {!compact && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => gen.mutate()} disabled={gen.isPending}>
            <Sparkles className="h-4 w-4" /> {gen.isPending ? "Analyzing…" : "Regenerate"}
          </Button>
        </div>
      )}
      {items.map((i) => (
        <InsightCard key={i.id} insight={i} compact={compact} />
      ))}
    </div>
  );
}
