"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { MetricPoint } from "@/types/models";

export function PRCycleTimeChart({ trend, loading }: { trend: MetricPoint[]; loading?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">PR Cycle Time — days (median, weekly)</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : trend.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No data yet</div>
        ) : (
          <ResponsiveContainer>
            <BarChart data={trend}>
              <XAxis dataKey="label" fontSize={11} stroke="#888" />
              <YAxis fontSize={11} stroke="#888" unit="d" />
              <Tooltip formatter={(v: number) => `${v.toFixed(2)} d`} />
              <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
