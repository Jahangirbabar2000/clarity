"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { MetricPoint } from "@/types/models";

export function BuildHealthChart({ trend, loading }: { trend: MetricPoint[]; loading?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Build Failure Rate — last 7 days</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : trend.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No data yet</div>
        ) : (
          <ResponsiveContainer>
            <LineChart data={trend.map((d) => ({ ...d, pct: +(d.value * 100).toFixed(1) }))}>
              <XAxis dataKey="label" fontSize={11} stroke="#888" />
              <YAxis fontSize={11} stroke="#888" unit="%" />
              <Tooltip formatter={(v: number) => `${v}%`} />
              <Line type="monotone" dataKey="pct" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
