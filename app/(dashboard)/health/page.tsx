"use client";

import { MetricCard } from "@/components/health/MetricCard";
import { QAPassRateChart } from "@/components/health/QAPassRateChart";
import { BugReopenChart } from "@/components/health/BugReopenChart";
import { PRCycleTimeChart } from "@/components/health/PRCycleTimeChart";
import { BuildHealthChart } from "@/components/health/BuildHealthChart";
import { LibraryHealthBar } from "@/components/health/LibraryHealthBar";
import { InsightFeed } from "@/components/insights/InsightFeed";
import {
  useBugReopen,
  useBuildHealth,
  useLibraryHealth,
  usePRCycleTime,
  useQAPassRate,
} from "@/lib/hooks/useMetrics";

export default function HealthPage() {
  const qa = useQAPassRate();
  const bug = useBugReopen();
  const pr = usePRCycleTime();
  const build = useBuildHealth();
  const lib = useLibraryHealth();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Engineering Health</h2>
        <p className="text-sm text-muted-foreground">Live metrics across QA, bugs, delivery and supply chain.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="QA Pass Rate"
          value={qa.data?.current ?? null}
          previous={qa.data?.previous ?? null}
          loading={qa.isLoading}
          formatter={(v) => `${Math.round(v * 100)}%`}
          higherIsBetter
        />
        <MetricCard
          label="Bug Reopen Rate"
          value={bug.data?.current ?? null}
          previous={bug.data?.previous ?? null}
          loading={bug.isLoading}
          formatter={(v) => `${(v * 100).toFixed(1)}%`}
          higherIsBetter={false}
        />
        <MetricCard
          label="PR Cycle Time"
          value={pr.data?.current ?? null}
          previous={pr.data?.previous ?? null}
          loading={pr.isLoading}
          formatter={(v) => v.toFixed(1)}
          unit="days"
          higherIsBetter={false}
        />
        <MetricCard
          label="Build Failure Rate"
          value={build.data?.current ?? null}
          previous={build.data?.previous ?? null}
          loading={build.isLoading}
          formatter={(v) => `${(v * 100).toFixed(1)}%`}
          higherIsBetter={false}
        />
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
        <InsightFeed limit={3} compact />
      </div>
    </div>
  );
}
