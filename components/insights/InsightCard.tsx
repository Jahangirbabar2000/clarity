"use client";

import { AlertTriangle, Lightbulb, TrendingUp, Info, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { AIInsight } from "@/types/models";
import { cn } from "@/lib/utils";

const TYPE_ICONS = {
  ANOMALY: AlertTriangle,
  TREND: TrendingUp,
  RECOMMENDATION: Lightbulb,
  SUMMARY: Info,
} as const;

const SEVERITY_VARIANT = {
  INFO: "info",
  WARNING: "warning",
  CRITICAL: "destructive",
} as const;

export function InsightCard({ insight, compact }: { insight: AIInsight; compact?: boolean }) {
  const Icon = TYPE_ICONS[insight.type as keyof typeof TYPE_ICONS] ?? Zap;
  return (
    <Card className={cn(compact && "border-l-4", insight.severity === "CRITICAL" && compact && "border-l-red-500", insight.severity === "WARNING" && compact && "border-l-amber-500", insight.severity === "INFO" && compact && "border-l-sky-400")}>
      <CardContent className="flex items-start gap-3 p-4">
        <div className="mt-0.5 rounded-md bg-accent p-1.5">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-medium">{insight.title}</div>
            <Badge variant={SEVERITY_VARIANT[insight.severity as keyof typeof SEVERITY_VARIANT]}>
              {insight.severity}
            </Badge>
            <Badge variant="outline">{insight.type}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{insight.body}</p>
        </div>
      </CardContent>
    </Card>
  );
}
