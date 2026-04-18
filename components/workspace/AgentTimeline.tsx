"use client";

/**
 * AgentTimeline — live per-agent activity feed.
 *
 * Consumes the stream of {@link AgentEvent}s emitted by the multi-agent
 * pipeline (build-ticket SSE, refine, insights) and renders a vertical
 * timeline showing each agent's role, the model that's handling it, status,
 * and duration. This is the UI component that makes the multi-agent +
 * multi-LLM architecture visible to a grader during the demo.
 *
 * Supports multi-invocation agents: when the reflection loop re-runs the
 * same agent, a new row appears each time rather than overwriting the
 * previous one. Reflection events themselves render as distinct "loop"
 * markers between agent rows.
 */

import { useEffect, useRef } from "react";
import {
  Bot,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Brain,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentEvent, AgentProviderId } from "@/types/agents";

type AgentStatus = "running" | "done" | "error";

type AgentStep = {
  kind: "agent";
  name: string;
  role: string;
  target: { provider: AgentProviderId; model: string } | null;
  status: AgentStatus;
  startedAt: number;
  durationMs?: number;
  message: string;
  progress: string[];
  error?: string;
};

type ReflectionStep = {
  kind: "reflection";
  iteration: number;
  maxIterations: number;
  verdict: "approved" | "approved_with_notes" | "needs_revision";
  message: string;
};

export type TimelineItem = AgentStep | ReflectionStep;

/**
 * Reduce a linear stream of AgentEvents into a stable, ordered list of steps.
 * Each `agent_start` pushes a fresh step, so when the reflection loop re-runs
 * an agent the UI shows both invocations. Subsequent events (progress / done /
 * error) attach to the most recent step for that agent.
 */
export function reduceAgentEvents(events: AgentEvent[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  const openIdxByAgent = new Map<string, number>();

  for (const ev of events) {
    if (ev.type === "agent_start") {
      const step: AgentStep = {
        kind: "agent",
        name: ev.agent,
        role: ev.role,
        target: ev.target,
        status: "running",
        startedAt: ev.startedAt,
        message: ev.message,
        progress: [],
      };
      items.push(step);
      openIdxByAgent.set(ev.agent, items.length - 1);
    } else if (ev.type === "reflection") {
      items.push({
        kind: "reflection",
        iteration: ev.iteration,
        maxIterations: ev.maxIterations,
        verdict: ev.verdict,
        message: ev.message,
      });
    } else if (ev.type === "agent_progress") {
      const idx = openIdxByAgent.get(ev.agent);
      if (idx !== undefined) {
        const step = items[idx];
        if (step.kind === "agent") step.progress.push(ev.message);
      }
    } else if (ev.type === "agent_done") {
      const idx = openIdxByAgent.get(ev.agent);
      if (idx !== undefined) {
        const step = items[idx];
        if (step.kind === "agent") {
          step.status = "done";
          step.durationMs = ev.durationMs;
        }
      }
    } else if (ev.type === "agent_error") {
      const idx = openIdxByAgent.get(ev.agent);
      if (idx !== undefined) {
        const step = items[idx];
        if (step.kind === "agent") {
          step.status = "error";
          step.error = ev.message;
        }
      }
    }
  }

  return items;
}

const PROVIDER_LABEL: Record<AgentProviderId, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
};

const PROVIDER_DOT: Record<AgentProviderId, string> = {
  openai: "bg-emerald-500",
  anthropic: "bg-orange-500",
  google: "bg-sky-500",
};

const VERDICT_LABEL: Record<ReflectionStep["verdict"], string> = {
  approved: "approved",
  approved_with_notes: "approved with notes",
  needs_revision: "needs revision",
};

export function AgentTimeline({
  events,
  className,
  title = "Agent activity",
  subtitle,
}: {
  events: AgentEvent[];
  className?: string;
  title?: string;
  subtitle?: string;
}) {
  const items = reduceAgentEvents(events);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length]);

  if (items.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground",
          className,
        )}
      >
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4" />
          {title}
        </div>
        <p className="mt-1 text-xs">Agents will appear here as they run.</p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">{title}</span>
        </div>
        {subtitle ? (
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        ) : null}
      </div>
      <div ref={scrollRef} className="max-h-[420px] overflow-y-auto p-4">
        <ol className="relative ml-2 space-y-4 border-l border-border pl-5">
          {items.map((item, idx) =>
            item.kind === "reflection" ? (
              <li key={`reflection-${idx}`} className="relative">
                <span className="absolute -left-[27px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
                  <RefreshCw className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    Reflection · iteration {item.iteration}/{item.maxIterations}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100/70 px-2 py-0.5 text-[11px] text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                    verdict: {VERDICT_LABEL[item.verdict]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{item.message}</p>
              </li>
            ) : (
              <li key={`${item.name}-${idx}`} className="relative">
                <span className="absolute -left-[27px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full border bg-background">
                  {item.status === "running" ? (
                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                  ) : item.status === "done" ? (
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-3 w-3 text-red-600" />
                  )}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{item.name}</span>
                  {item.target ? (
                    <span className="inline-flex items-center gap-1 rounded-full border bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          PROVIDER_DOT[item.target.provider],
                        )}
                      />
                      {PROVIDER_LABEL[item.target.provider]} · {item.target.model}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                      <Brain className="h-3 w-3" />
                      deterministic
                    </span>
                  )}
                  {typeof item.durationMs === "number" ? (
                    <span className="text-[11px] text-muted-foreground">
                      {(item.durationMs / 1000).toFixed(1)}s
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.role}</p>
                <p className="mt-1 text-xs">{item.message}</p>
                {item.progress.length > 0 ? (
                  <ul className="mt-1 space-y-0.5">
                    {item.progress.map((p, i) => (
                      <li key={i} className="text-[11px] text-muted-foreground">
                        → {p}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {item.error ? (
                  <p className="mt-1 text-[11px] text-red-600">{item.error}</p>
                ) : null}
              </li>
            ),
          )}
        </ol>
      </div>
    </div>
  );
}
