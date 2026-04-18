import type { MetricSeries } from "@/types/models";
import { USE_MOCKS } from "@/lib/utils";
import { mockTopErrors } from "./mock-data";

const mockErrorRate: MetricSeries = {
  hasData: true,
  current: 0.013,
  previous: 0.009,
  trend: [
    { label: "D1", value: 0.008 },
    { label: "D2", value: 0.009 },
    { label: "D3", value: 0.011 },
    { label: "D4", value: 0.012 },
    { label: "D5", value: 0.014 },
    { label: "D6", value: 0.013 },
    { label: "D7", value: 0.013 },
  ],
};

export async function getErrorRate(_orgSlug: string, _projectSlug: string, _sinceDays = 7): Promise<MetricSeries> {
  if (USE_MOCKS || !process.env.SENTRY_AUTH_TOKEN) return mockErrorRate;
  return mockErrorRate;
}

export async function getTopErrors(_orgSlug: string, _projectSlug: string) {
  if (USE_MOCKS || !process.env.SENTRY_AUTH_TOKEN) return mockTopErrors;
  return mockTopErrors;
}
