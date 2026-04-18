import type { MetricSeries } from "@/types/models";
import { USE_MOCKS } from "@/lib/utils";

export async function getP95ResponseTime(
  _metricName: string,
  _sinceDays = 14,
): Promise<MetricSeries> {
  const hasCreds = Boolean(process.env.DATADOG_API_KEY && process.env.DATADOG_APP_KEY);
  if (!hasCreds && !USE_MOCKS) {
    return { hasData: false, current: null, previous: null, trend: [] };
  }
  return {
    hasData: true,
    current: 420,
    previous: 380,
    trend: [
      { label: "D1", value: 340 },
      { label: "D2", value: 360 },
      { label: "D3", value: 370 },
      { label: "D4", value: 390 },
      { label: "D5", value: 400 },
      { label: "D6", value: 415 },
      { label: "D7", value: 420 },
    ],
  };
}
