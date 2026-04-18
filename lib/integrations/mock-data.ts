import type { MetricSeries } from "@/types/models";

export const mockQAPassRate: MetricSeries = {
  hasData: true,
  current: 0.78,
  previous: 0.84,
  trend: [
    { label: "S11", value: 0.81 },
    { label: "S12", value: 0.83 },
    { label: "S13", value: 0.86 },
    { label: "S14", value: 0.82 },
    { label: "S15", value: 0.85 },
    { label: "S16", value: 0.84 },
    { label: "S17", value: 0.84 },
    { label: "S18", value: 0.78 },
  ],
};

export const mockBugReopen: MetricSeries = {
  hasData: true,
  current: 0.12,
  previous: 0.08,
  trend: [
    { label: "W1", value: 0.06 },
    { label: "W2", value: 0.08 },
    { label: "W3", value: 0.07 },
    { label: "W4", value: 0.09 },
    { label: "W5", value: 0.1 },
    { label: "W6", value: 0.11 },
    { label: "W7", value: 0.12 },
    { label: "W8", value: 0.12 },
  ],
};

export const mockPRCycleTime: MetricSeries = {
  hasData: true,
  current: 2.4,
  previous: 3.1,
  trend: [
    { label: "W1", value: 3.4 },
    { label: "W2", value: 3.1 },
    { label: "W3", value: 2.9 },
    { label: "W4", value: 3.0 },
    { label: "W5", value: 2.6 },
    { label: "W6", value: 2.5 },
    { label: "W7", value: 2.4 },
    { label: "W8", value: 2.4 },
  ],
};

export const mockBuildHealth: MetricSeries = {
  hasData: true,
  current: 0.09,
  previous: 0.06,
  trend: [
    { label: "Mon", value: 0.05 },
    { label: "Tue", value: 0.07 },
    { label: "Wed", value: 0.1 },
    { label: "Thu", value: 0.08 },
    { label: "Fri", value: 0.12 },
    { label: "Sat", value: 0.04 },
    { label: "Sun", value: 0.09 },
  ],
};

export const mockLibraryHealth = {
  hasData: true,
  upToDate: 0.62,
  minorUpdates: 0.31,
  criticalCVEs: 0.07,
  sample: [
    { name: "next", current: "14.1.0", latest: "14.2.16", severity: "minor" as const },
    { name: "lodash", current: "4.17.19", latest: "4.17.21", severity: "critical" as const },
    { name: "zod", current: "3.23.8", latest: "3.23.8", severity: "ok" as const },
    { name: "ioredis", current: "5.3.0", latest: "5.4.1", severity: "minor" as const },
    { name: "axios", current: "0.21.1", latest: "1.7.7", severity: "critical" as const },
  ],
};

export const mockVelocity = {
  committed: 62,
  delivered: 54,
  trend: [48, 52, 55, 58, 60, 54],
};

export const mockTopErrors = [
  { type: "TypeError: cannot read properties of undefined", count: 243 },
  { type: "TimeoutError: /api/checkout", count: 128 },
  { type: "PrismaClientKnownRequestError: P2002", count: 91 },
  { type: "NotFoundError: /workspace/:id", count: 64 },
  { type: "ZodError: invalid_type", count: 39 },
];

export const mockRecentCommits = [
  { path: "app/api/checkout/route.ts", summary: "Checkout handler with Stripe webhook validation" },
  { path: "lib/services/pricing.ts", summary: "Pricing service — tier-based discount logic" },
  { path: "components/CheckoutForm.tsx", summary: "Checkout form with multi-step wizard" },
  { path: "prisma/schema.prisma", summary: "Order, Customer, LineItem models" },
  { path: "lib/currency.ts", summary: "Currency conversion helpers — FX rates cached 1h" },
];

export const mockJiraRecent = [
  "Add tier-based pricing to billing module",
  "Fix checkout webhook signature validation",
  "Spike: multi-currency support feasibility",
  "Improve error messaging in payment flow",
  "Bug: order total miscalculated for bundled items",
  "Refactor CheckoutForm into step-based wizard",
  "Add Stripe test-mode toggle to admin",
  "Implement subscription pause/resume",
  "Fix N+1 query in orders list",
  "Add Datadog tracing to checkout route",
];
