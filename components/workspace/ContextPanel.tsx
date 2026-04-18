"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Github, BookOpen, FileText, Database, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export type ContextSummary = {
  sources: { github: boolean; jira: boolean; notion: boolean; prd: boolean; existingTickets: number };
  techStack?: string[];
  files?: string[];
  notionPages?: string[];
  prdFilename?: string | null;
};

export function ContextPanel({
  summary,
  onRefresh,
  refreshing,
}: {
  summary?: ContextSummary;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const [open, setOpen] = useState(true);
  if (!summary) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Context used
          </button>
          {onRefresh ? (
            <Button variant="ghost" size="sm" onClick={onRefresh} disabled={refreshing}>
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} /> Refresh
            </Button>
          ) : null}
        </CardTitle>
      </CardHeader>
      {open ? (
        <CardContent className="space-y-3 pt-0">
          <div className="flex flex-wrap gap-2">
            <SourceBadge icon={Github} label="GitHub" active={summary.sources.github} />
            <SourceBadge icon={Database} label="Jira" active={summary.sources.jira} />
            <SourceBadge icon={BookOpen} label="Notion" active={summary.sources.notion} />
            <SourceBadge icon={FileText} label="PRD" active={summary.sources.prd} />
          </div>

          {summary.sources.github && summary.files && summary.files.length > 0 ? (
            <Section title="GitHub files">
              {summary.files.map((f) => (
                <div key={f} className="font-mono text-xs text-muted-foreground">{f}</div>
              ))}
            </Section>
          ) : null}

          {summary.techStack && summary.techStack.length > 0 ? (
            <Section title="Detected tech">
              <div className="flex flex-wrap gap-1">
                {summary.techStack.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
              </div>
            </Section>
          ) : null}

          <Section title="Jira history">
            <div className="text-xs text-muted-foreground">
              {summary.sources.existingTickets} existing tickets used as style reference.
            </div>
          </Section>

          {summary.prdFilename ? (
            <Section title="PRD">
              <div className="text-xs text-muted-foreground">{summary.prdFilename}</div>
            </Section>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}

function SourceBadge({ icon: Icon, label, active }: { icon: React.ComponentType<{ className?: string }>; label: string; active: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
        active ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-muted bg-muted/40 text-muted-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium">{title}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
