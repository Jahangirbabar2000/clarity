"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { LibraryHealthResponse } from "@/types/api";

export function LibraryHealthBar({ data, loading }: { data?: LibraryHealthResponse; loading?: boolean }) {
  if (loading || !data) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm">Library Health</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-40 w-full" /></CardContent>
      </Card>
    );
  }
  const up = Math.round(data.upToDate * 100);
  const minor = Math.round(data.minorUpdates * 100);
  const crit = Math.round(data.criticalCVEs * 100);
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Library Health</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
          <div style={{ width: `${up}%` }} className="bg-emerald-500" title={`Up to date ${up}%`} />
          <div style={{ width: `${minor}%` }} className="bg-amber-400" title={`Minor ${minor}%`} />
          <div style={{ width: `${crit}%` }} className="bg-red-500" title={`Critical ${crit}%`} />
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <Legend color="bg-emerald-500" label={`Up to date ${up}%`} />
          <Legend color="bg-amber-400" label={`Minor ${minor}%`} />
          <Legend color="bg-red-500" label={`Critical ${crit}%`} />
        </div>
        <div className="space-y-1">
          {data.sample.slice(0, 5).map((s) => (
            <div key={s.name} className="flex items-center justify-between text-xs">
              <div className="font-mono">{s.name}</div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>{s.current} → {s.latest}</span>
                <Badge variant={s.severity === "critical" ? "destructive" : s.severity === "minor" ? "warning" : "success"}>
                  {s.severity}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </div>
  );
}
