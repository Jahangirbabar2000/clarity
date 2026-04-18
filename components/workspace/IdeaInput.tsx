"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Github, FileText, BookOpen, Database, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

type Source = { key: string; label: string; icon: React.ComponentType<{ className?: string }>; connected: boolean };

export function IdeaInput({
  onSubmit,
  loading,
  progress,
  sources = defaultSources,
}: {
  onSubmit: (idea: string) => void;
  loading: boolean;
  progress?: string;
  sources?: Source[];
}) {
  const [idea, setIdea] = useState("");
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Sparkles className="h-5 w-5" />
        </div>
        <h2 className="text-2xl font-semibold">Turn an idea into a shippable ticket</h2>
        <p className="text-sm text-muted-foreground">
          Describe the feature, bug, or idea in your own words. Clarity reads your codebase, PRD, Notion and Jira history to write the rest.
        </p>
      </div>

      <Card>
        <CardContent className="p-5">
          <Textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            rows={6}
            disabled={loading}
            placeholder="e.g. Let customers pay in their local currency at checkout. Right now we only support USD and it's a blocker for international growth."
          />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {sources.map((s) => (
                <div
                  key={s.key}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                    s.connected
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-muted bg-muted/50 text-muted-foreground",
                  )}
                >
                  <s.icon className="h-3.5 w-3.5" />
                  {s.label}
                  {s.connected ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <Circle className="h-3 w-3" />
                  )}
                </div>
              ))}
            </div>
            <Button onClick={() => idea.trim() && onSubmit(idea.trim())} disabled={loading || !idea.trim()}>
              <Sparkles className="h-4 w-4" />
              {loading ? "Building…" : "Build ticket"}
            </Button>
          </div>
          {loading && progress ? (
            <div className="mt-4 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              <Sparkles className="mr-1 inline h-3 w-3 animate-pulse" /> {progress}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

const defaultSources: Source[] = [
  { key: "github", label: "GitHub", icon: Github, connected: true },
  { key: "notion", label: "Notion", icon: BookOpen, connected: true },
  { key: "prd", label: "PRD", icon: FileText, connected: false },
  { key: "jira", label: "Jira", icon: Database, connected: true },
];
