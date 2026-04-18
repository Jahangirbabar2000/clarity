"use client";

import { useQuery } from "@tanstack/react-query";
import type { MetricSeries } from "@/types/models";
import type { LibraryHealthResponse } from "@/types/api";

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export function useQAPassRate() {
  return useQuery<MetricSeries>({
    queryKey: ["metrics", "qa-pass-rate"],
    queryFn: () => fetchJSON("/api/metrics/qa-pass-rate?n=8"),
  });
}
export function useBugReopen() {
  return useQuery<MetricSeries>({
    queryKey: ["metrics", "bug-reopen"],
    queryFn: () => fetchJSON("/api/metrics/bug-reopen"),
  });
}
export function usePRCycleTime() {
  return useQuery<MetricSeries>({
    queryKey: ["metrics", "pr-cycle-time"],
    queryFn: () => fetchJSON("/api/metrics/pr-cycle-time"),
  });
}
export function useBuildHealth() {
  return useQuery<MetricSeries>({
    queryKey: ["metrics", "build-health"],
    queryFn: () => fetchJSON("/api/metrics/build-health"),
  });
}
export function useLibraryHealth() {
  return useQuery<LibraryHealthResponse>({
    queryKey: ["metrics", "library-health"],
    queryFn: () => fetchJSON("/api/metrics/library-health"),
  });
}
