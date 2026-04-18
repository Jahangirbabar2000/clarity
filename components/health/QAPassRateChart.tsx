"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { MetricPoint } from "@/types/models";

function color(v: number) {
  if (v >= 0.9) return "#10b981";
  if (v >= 0.8) return "#84cc16";
  if (v >= 0.7) return "#f59e0b";
  return "#ef4444";
}

export function QAPassRateChart({ trend, loading }: { trend: MetricPoint[]; loading?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">QA Pass Rate — last 8 sprints</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : trend.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer>
            <BarChart data={trend.map((d) => ({ ...d, pct: Math.round(d.value * 100) }))}>
              <XAxis dataKey="label" fontSize={11} stroke="#888" />
              <YAxis fontSize={11} stroke="#888" domain={[0, 100]} unit="%" />
              <Tooltip formatter={(v: number) => `${v}%`} />
              <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                {trend.map((d, i) => (
                  <Cell key={i} fill={color(d.value)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No data yet</div>;
}
