"use client";

/**
 * AgentTimeline — live per-agent activity feed.
 *
 * Consumes the stream of {@link AgentEvent}s emitted by the multi-agent
 * pipeline (build-ticket SSE, refine, insights) and renders a vertical
 * timeline showing each agent's role, the model that's handling it, status,
 * and duration. This is the UI component that makes the multi-agent +
 * multi-LLM architecture visible to a grader during the demo.
 */

import { useEffect, useRef } from "react";
import { Bot, CheckCircle2, Loader2, AlertCircle, Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentEvent, AgentProviderId } from "@/types/agents";

type AgentStatus = "running" | "done" | "error";

type AgentStep = {
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

/**
 * Reduce a linear stream of AgentEvents into a stable, ordered list of steps.
 * Exported so pages can compute agentSteps once and pass a slice or memo.
 */
export function reduceAgentEvents(events: AgentEvent[]): AgentStep[] {
  const byName = new Map<string, AgentStep>();
  const order: string[] = [];

  for (const ev of events) {
    if (ev.type === "agent_start") {
      if (!byName.has(ev.agent)) order.push(ev.agent);
      byName.set(ev.agent, {
        name: ev.agent,
        role: ev.role,
        target: ev.target,
        status: "running",
        startedAt: ev.startedAt,
        message: ev.message,
        progress: [],
      });
    } else if (ev.type === "agent_progress") {
      const step = byName.get(ev.agent);
      if (step) step.progress.push(ev.message);
    } else if (ev.type === "agent_done") {
      const step = byName.get(ev.agent);
      if (step) {
        step.status = "done";
        step.durationMs = ev.durationMs;
      }
    } else if (ev.type === "agent_error") {
      const step = byName.get(ev.agent);
      if (step) {
        step.status = "error";
        step.error = ev.message;
      }
    }
  }

  return order.map((n) => byName.get(n)!).filter(Boolean);
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
  const steps = reduceAgentEvents(events);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length]);

  if (steps.length === 0) {
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
          {steps.map((step, idx) => (
            <li key={`${step.name}-${idx}`} className="relative">
              <span className="absolute -left-[27px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full border bg-background">
                {step.status === "running" ? (
                  <Loader2 className="h-3 w-3 animate-spin text-primary" />
                ) : step.status === "done" ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-3 w-3 text-red-600" />
                )}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{step.name}</span>
                {step.target ? (
                  <span className="inline-flex items-center gap-1 rounded-full border bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        PROVIDER_DOT[step.target.provider],
                      )}
                    />
                    {PROVIDER_LABEL[step.target.provider]} · {step.target.model}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                    <Brain className="h-3 w-3" />
                    deterministic
                  </span>
                )}
                {typeof step.durationMs === "number" ? (
                  <span className="text-[11px] text-muted-foreground">
                    {(step.durationMs / 1000).toFixed(1)}s
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{step.role}</p>
              <p className="mt-1 text-xs">{step.message}</p>
              {step.progress.length > 0 ? (
                <ul className="mt-1 space-y-0.5">
                  {step.progress.map((p, i) => (
                    <li key={i} className="text-[11px] text-muted-foreground">
                      → {p}
                    </li>
                  ))}
                </ul>
              ) : null}
              {step.error ? (
                <p className="mt-1 text-[11px] text-red-600">{step.error}</p>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
