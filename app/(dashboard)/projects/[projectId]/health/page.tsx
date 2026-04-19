"use client";

import { useParams } from "next/navigation";
import { MetricCard } from "@/components/health/MetricCard";
import { QAPassRateChart } from "@/components/health/QAPassRateChart";
import { BugReopenChart } from "@/components/health/BugReopenChart";
import { PRCycleTimeChart } from "@/components/health/PRCycleTimeChart";
import { BuildHealthChart } from "@/components/health/BuildHealthChart";
import { LibraryHealthBar } from "@/components/health/LibraryHealthBar";
import { InsightFeed } from "@/components/insights/InsightFeed";
import { useBugReopen, useBuildHealth, useLibraryHealth, usePRCycleTime, useQAPassRate } from "@/lib/hooks/useMetrics";
import { useDemoMode } from "@/lib/hooks/useDemoMode";
import { Switch } from "@/components/ui/switch";
import { FlaskConical } from "lucide-react";

export default function HealthPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { demo, toggle } = useDemoMode();

  const qa = useQAPassRate(projectId, demo);
  const bug = useBugReopen(projectId, demo);
  const pr = usePRCycleTime(projectId, demo);
  const build = useBuildHealth(projectId, demo);
  const lib = useLibraryHealth(projectId, demo);

  const connectHref = `/projects/${projectId}/connections`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Engineering Health</h2>
          <p className="text-sm text-muted-foreground">Live metrics across QA, bugs, delivery and supply chain.</p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
          <FlaskConical className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Demo data</span>
          <Switch checked={demo} onCheckedChange={toggle} />
        </label>
      </div>

      {demo && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Showing sample data. Connect your integrations to see real metrics.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="QA Pass Rate" value={qa.data?.current ?? null} previous={qa.data?.previous ?? null} loading={qa.isLoading} formatter={(v) => `${Math.round(v * 100)}%`} higherIsBetter connectHref={connectHref} connectLabel="Connect Jira" />
        <MetricCard label="Bug Reopen Rate" value={bug.data?.current ?? null} previous={bug.data?.previous ?? null} loading={bug.isLoading} formatter={(v) => `${(v * 100).toFixed(1)}%`} higherIsBetter={false} connectHref={connectHref} connectLabel="Connect Jira" />
        <MetricCard label="PR Cycle Time" value={pr.data?.current ?? null} previous={pr.data?.previous ?? null} loading={pr.isLoading} formatter={(v) => v.toFixed(1)} unit="days" higherIsBetter={false} connectHref={connectHref} connectLabel="Connect GitHub" />
        <MetricCard label="Build Failure Rate" value={build.data?.current ?? null} previous={build.data?.previous ?? null} loading={build.isLoading} formatter={(v) => `${(v * 100).toFixed(1)}%`} higherIsBetter={false} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <QAPassRateChart trend={qa.data?.trend ?? []} loading={qa.isLoading} />
        <LibraryHealthBar data={lib.data} loading={lib.isLoading} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <BugReopenChart trend={bug.data?.trend ?? []} loading={bug.isLoading} />
        <PRCycleTimeChart trend={pr.data?.trend ?? []} loading={pr.isLoading} />
      </div>

      <BuildHealthChart trend={build.data?.trend ?? []} loading={build.isLoading} />

      <div>
        <h3 className="mb-2 text-sm font-semibold">Recent AI insights</h3>
        <InsightFeed limit={3} compact projectId={projectId} />
      </div>
    </div>
  );
}
