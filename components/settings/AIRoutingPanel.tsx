"use client";

/**
 * AIRoutingPanel — public evidence of the multi-LLM routing architecture.
 *
 * Reads /api/ai/routing and renders:
 *   - Which providers are currently configured on this deployment
 *   - The agent registry (role + task each agent delegates to)
 *   - The routing table per task: primary target + fallbacks with rationale
 *
 * This is the clearest artifact for demonstrating the "3+ LLMs with intelligent
 * routing" requirement — a reader can see exactly which model handles which
 * step and why (rationale text is grounded in 2026 benchmarks).
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Bot, Sparkles, CheckCircle2, Circle } from "lucide-react";

type ProviderId = "openai" | "anthropic" | "google";

type RouteTarget = {
  provider: ProviderId;
  model: string;
  rationale: string;
};

type TaskType =
  | "long_context_summary"
  | "creative_longform"
  | "analytical_reasoning"
  | "critique"
  | "refinement"
  | "classification";

type AgentMeta = {
  name: string;
  role: string;
  task: TaskType | null;
};

type RoutingSnapshot = {
  task: TaskType;
  chosen: RouteTarget | null;
  isPreferred: boolean;
  preferredTarget: RouteTarget;
};

type RoutingResponse = {
  configuredProviders: ProviderId[];
  snapshot: RoutingSnapshot[];
  routingTable: Record<TaskType, RouteTarget[]>;
  agents: AgentMeta[];
};

const PROVIDER_LABEL: Record<ProviderId, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
};

const PROVIDER_DOT: Record<ProviderId, string> = {
  openai: "bg-emerald-500",
  anthropic: "bg-orange-500",
  google: "bg-sky-500",
};

const TASK_LABEL: Record<TaskType, string> = {
  long_context_summary: "Long-context summary",
  creative_longform: "Creative long-form",
  analytical_reasoning: "Analytical reasoning",
  critique: "Critique / review",
  refinement: "Field-scoped refinement",
  classification: "Classification / routing",
};

export function AIRoutingPanel() {
  const { data, isLoading } = useQuery<RoutingResponse>({
    queryKey: ["ai-routing"],
    queryFn: async () => (await fetch("/api/ai/routing")).json(),
    staleTime: 60_000,
  });

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI routing</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Loading…</CardContent>
      </Card>
    );
  }

  const providers: ProviderId[] = ["openai", "anthropic", "google"];
  const configured = new Set(data.configuredProviders);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">AI routing</h2>
        <p className="text-sm text-muted-foreground">
          Clarity uses a Model Router to pick the best LLM for each task, with
          automatic fallback to whichever providers you&apos;ve configured.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Configured providers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {providers.map((p) => {
              const isOn = configured.has(p);
              return (
                <div
                  key={p}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                    isOn
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-muted bg-muted/50 text-muted-foreground",
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", PROVIDER_DOT[p])} />
                  {PROVIDER_LABEL[p]}
                  {isOn ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <Circle className="h-3 w-3" />
                  )}
                </div>
              );
            })}
          </div>
          {configured.size < 2 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Add more provider keys in <code className="rounded bg-muted px-1">.env.local</code>{" "}
              to unlock true multi-vendor routing. With only one configured
              provider, the router falls back to that provider for every task.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Agents</CardTitle>
          <p className="text-xs text-muted-foreground">
            Each named agent owns one role in the pipeline and routes to the best-fit
            LLM for its task (or runs deterministically when no model is needed).
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {data.agents.map((a) => {
              const snap = a.task
                ? data.snapshot.find((s) => s.task === a.task)
                : undefined;
              return (
                <div key={a.name} className="rounded-md border p-3">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{a.name}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{a.role}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                    {a.task ? (
                      <Badge variant="outline">{TASK_LABEL[a.task]}</Badge>
                    ) : (
                      <Badge variant="outline">Deterministic</Badge>
                    )}
                    {snap?.chosen ? (
                      <span className="inline-flex items-center gap-1 rounded-full border bg-muted/60 px-2 py-0.5">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            PROVIDER_DOT[snap.chosen.provider],
                          )}
                        />
                        {PROVIDER_LABEL[snap.chosen.provider]} · {snap.chosen.model}
                        {!snap.isPreferred ? (
                          <span className="ml-1 opacity-70">(fallback)</span>
                        ) : null}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Routing table</CardTitle>
          <p className="text-xs text-muted-foreground">
            Primary + fallback chain for every task type, with the benchmark-grounded
            rationale for each choice.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {(Object.keys(data.routingTable) as TaskType[]).map((task) => {
              const chain = data.routingTable[task];
              const snap = data.snapshot.find((s) => s.task === task);
              return (
                <div key={task} className="rounded-md border">
                  <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      <span className="text-sm font-medium">{TASK_LABEL[task]}</span>
                    </div>
                    {snap?.chosen ? (
                      <Badge variant="outline" className="text-[10px]">
                        {snap.isPreferred ? "Primary" : "Using fallback"}
                      </Badge>
                    ) : null}
                  </div>
                  <ol className="divide-y">
                    {chain.map((t, i) => {
                      const isChosen = snap?.chosen?.provider === t.provider && snap?.chosen?.model === t.model;
                      return (
                        <li
                          key={`${t.provider}-${t.model}`}
                          className={cn(
                            "flex items-start gap-3 px-3 py-2 text-xs",
                            isChosen ? "bg-emerald-50/40" : "",
                          )}
                        >
                          <span className="mt-0.5 text-[10px] text-muted-foreground">
                            {i === 0 ? "Primary" : `Fallback ${i}`}
                          </span>
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={cn("h-1.5 w-1.5 rounded-full", PROVIDER_DOT[t.provider])}
                              />
                              <span className="font-medium">
                                {PROVIDER_LABEL[t.provider]} · {t.model}
                              </span>
                              {isChosen ? (
                                <span className="text-[10px] text-emerald-700">← active</span>
                              ) : null}
                            </div>
                            <p className="mt-0.5 text-muted-foreground">{t.rationale}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
