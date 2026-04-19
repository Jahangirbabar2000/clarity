"use client";

import { useQuery } from "@tanstack/react-query";
import type { MetricSeries } from "@/types/models";
import type { LibraryHealthResponse } from "@/types/api";

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

function withParams(base: string, projectId?: string, demo?: boolean) {
  const url = new URL(base, "http://localhost");
  if (projectId) url.searchParams.set("projectId", projectId);
  if (demo) url.searchParams.set("demo", "true");
  return url.pathname + url.search;
}

export function useQAPassRate(projectId?: string, demo?: boolean) {
  return useQuery<MetricSeries>({
    queryKey: ["metrics", "qa-pass-rate", projectId, demo],
    queryFn: () => fetchJSON(withParams("/api/metrics/qa-pass-rate?n=8", projectId, demo)),
  });
}
export function useBugReopen(projectId?: string, demo?: boolean) {
  return useQuery<MetricSeries>({
    queryKey: ["metrics", "bug-reopen", projectId, demo],
    queryFn: () => fetchJSON(withParams("/api/metrics/bug-reopen", projectId, demo)),
  });
}
export function usePRCycleTime(projectId?: string, demo?: boolean) {
  return useQuery<MetricSeries>({
    queryKey: ["metrics", "pr-cycle-time", projectId, demo],
    queryFn: () => fetchJSON(withParams("/api/metrics/pr-cycle-time", projectId, demo)),
  });
}
export function useBuildHealth(projectId?: string, demo?: boolean) {
  return useQuery<MetricSeries>({
    queryKey: ["metrics", "build-health", projectId, demo],
    queryFn: () => fetchJSON(withParams("/api/metrics/build-health", projectId, demo)),
  });
}
export function useLibraryHealth(projectId?: string, demo?: boolean) {
  return useQuery<LibraryHealthResponse>({
    queryKey: ["metrics", "library-health", projectId, demo],
    queryFn: () => fetchJSON(withParams("/api/metrics/library-health", projectId, demo)),
  });
}
