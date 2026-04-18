"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  unit,
  previous,
  loading,
  formatter = (v) => v.toString(),
  // true = higher is better (e.g. QA pass rate). false = lower is better (e.g. bug reopen)
  higherIsBetter = true,
}: {
  label: string;
  value: number | null;
  previous?: number | null;
  unit?: string;
  loading?: boolean;
  formatter?: (v: number) => string;
  higherIsBetter?: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm text-muted-foreground">{label}</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-8 w-24" /></CardContent>
      </Card>
    );
  }
  if (value == null) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm text-muted-foreground">{label}</CardTitle></CardHeader>
        <CardContent><div className="text-2xl font-semibold text-muted-foreground">—</div></CardContent>
      </Card>
    );
  }
  const delta = previous == null ? null : value - previous;
  const improved = delta == null ? null : higherIsBetter ? delta > 0 : delta < 0;
  const Icon = delta == null ? Minus : (higherIsBetter ? delta > 0 : delta < 0) ? ArrowUpRight : ArrowDownRight;
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent className="space-y-1">
        <div className="flex items-baseline gap-2">
          <div className="text-3xl font-semibold">{formatter(value)}</div>
          {unit ? <div className="text-sm text-muted-foreground">{unit}</div> : null}
        </div>
        {delta != null ? (
          <div
            className={cn(
              "flex items-center gap-1 text-xs",
              improved ? "text-emerald-600" : "text-red-600",
            )}
          >
            <Icon className="h-3 w-3" />
            {formatter(Math.abs(delta))} vs previous
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
