"use client";

/**
 * CriticReview — surfaces the CriticAgent's structured notes inside the
 * ticket editor. Each note is field-scoped, so a PM can see at-a-glance
 * which parts of the draft a senior-reviewer-style LLM flagged.
 */

import { ShieldCheck, AlertTriangle, Info, OctagonX, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CritiqueReport, CritiqueSeverity } from "@/types/agents";

const SEVERITY_STYLES: Record<
  CritiqueSeverity,
  { icon: React.ComponentType<{ className?: string }>; bg: string; text: string; dot: string }
> = {
  info: { icon: Info, bg: "bg-sky-50 border-sky-200", text: "text-sky-900", dot: "bg-sky-500" },
  warning: {
    icon: AlertTriangle,
    bg: "bg-amber-50 border-amber-200",
    text: "text-amber-900",
    dot: "bg-amber-500",
  },
  blocker: {
    icon: OctagonX,
    bg: "bg-red-50 border-red-200",
    text: "text-red-900",
    dot: "bg-red-500",
  },
};

const VERDICT_LABEL: Record<CritiqueReport["verdict"], string> = {
  approved: "Approved",
  approved_with_notes: "Approved with notes",
  needs_revision: "Needs revision",
};

const VERDICT_STYLE: Record<CritiqueReport["verdict"], string> = {
  approved: "border-emerald-200 bg-emerald-50 text-emerald-900",
  approved_with_notes: "border-amber-200 bg-amber-50 text-amber-900",
  needs_revision: "border-red-200 bg-red-50 text-red-900",
};

export function CriticReview({ critique }: { critique: CritiqueReport }) {
  return (
    <div className={cn("rounded-lg border p-4", VERDICT_STYLE[critique.verdict])}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-white/70">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Critic Agent</span>
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px]">
              {VERDICT_LABEL[critique.verdict]}
            </span>
            <span className="text-[11px] opacity-80">
              Reviewed by a different LLM than the Writer — multi-agent check.
            </span>
          </div>
          <p className="mt-1 text-sm">{critique.summary}</p>
          {critique.toolCalls && critique.toolCalls.length > 0 ? (
            <div className="mt-3 rounded-md border border-dashed bg-white/60 p-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <Wrench className="h-3 w-3" />
                Tool calls ({critique.toolCalls.length})
              </div>
              <ul className="mt-1 space-y-1">
                {critique.toolCalls.map((tc, i) => (
                  <li key={i} className="text-[11px] text-muted-foreground">
                    <code className="rounded bg-muted/60 px-1 py-0.5">
                      {tc.name}({Object.keys(tc.args).length ? JSON.stringify(tc.args) : ""})
                    </code>{" "}
                    <span className="opacity-70">→ {tc.resultPreview.slice(0, 160)}{tc.resultPreview.length > 160 ? "…" : ""}</span>
                    {tc.error ? (
                      <span className="ml-1 text-red-600">error: {tc.error}</span>
                    ) : null}
                    <span className="ml-1 opacity-60">({tc.durationMs}ms)</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {critique.notes.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {critique.notes.map((n, i) => {
                const style = SEVERITY_STYLES[n.severity];
                const SeverityIcon = style.icon;
                return (
                  <li
                    key={i}
                    className={cn("rounded-md border p-2.5 text-sm", style.bg, style.text)}
                  >
                    <div className="flex items-center gap-2">
                      <SeverityIcon className="h-3.5 w-3.5" />
                      <span className="font-medium capitalize">
                        {n.field === "acceptanceCriteria"
                          ? "Acceptance criteria"
                          : n.field === "edgeCases"
                          ? "Edge cases"
                          : n.field === "outOfScope"
                          ? "Out of scope"
                          : n.field === "storyPoints"
                          ? "Story points"
                          : n.field}
                      </span>
                      <span className="text-[11px] uppercase opacity-70">{n.severity}</span>
                    </div>
                    <p className="mt-1">{n.message}</p>
                    {n.suggestion ? (
                      <p className="mt-1 text-xs opacity-80">
                        <span className="font-medium">Suggestion:</span> {n.suggestion}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}
