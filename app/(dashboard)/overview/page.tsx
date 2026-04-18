"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Activity, Sparkles, ClipboardList, Lightbulb } from "lucide-react";
import { MetricCard } from "@/components/health/MetricCard";
import { InsightFeed } from "@/components/insights/InsightFeed";
import { useBugReopen, usePRCycleTime, useQAPassRate } from "@/lib/hooks/useMetrics";

export default function OverviewPage() {
  const qa = useQAPassRate();
  const bug = useBugReopen();
  const pr = usePRCycleTime();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Hero
          href="/workspace/new"
          icon={Sparkles}
          title="Idea → shippable ticket"
          desc="Describe a feature in one sentence. Get a full Jira-ready ticket with subtasks."
        />
        <Hero
          href="/health"
          icon={Activity}
          title="Engineering health"
          desc="QA pass rate, bug reopens, PR cycle time, and library CVEs at a glance."
        />
        <Hero
          href="/insights"
          icon={Lightbulb}
          title="AI insights"
          desc="Anomalies, trends and concrete recommendations generated from your metrics."
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
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
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Latest AI insights</CardTitle>
          <Link href="/insights" className="text-xs text-muted-foreground hover:text-foreground">View all →</Link>
        </CardHeader>
        <CardContent>
          <InsightFeed limit={3} compact />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm"><ClipboardList className="h-4 w-4" /> Your workspace</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Jump into the ticket builder or review drafts.</p>
          <Link href="/workspace"><Button variant="outline">Open workspace <ArrowRight className="h-3.5 w-3.5" /></Button></Link>
        </CardContent>
      </Card>
    </div>
  );
}

function Hero({ href, icon: Icon, title, desc }: { href: string; icon: React.ComponentType<{ className?: string }>; title: string; desc: string }) {
  return (
    <Link href={href}>
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="space-y-2 p-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Icon className="h-4 w-4" />
          </div>
          <div className="font-semibold">{title}</div>
          <p className="text-sm text-muted-foreground">{desc}</p>
          <div className="flex items-center gap-1 pt-2 text-xs text-primary">Open <ArrowRight className="h-3 w-3" /></div>
        </CardContent>
      </Card>
    </Link>
  );
}
