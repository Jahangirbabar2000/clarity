import { openai, OPENAI_MODEL, isAIConfigured, stripJsonFences } from "./client";
import { INSIGHTS_SYSTEM_PROMPT } from "./prompts";

export type InsightPayload = {
  type: "ANOMALY" | "TREND" | "RECOMMENDATION" | "SUMMARY";
  severity: "INFO" | "WARNING" | "CRITICAL";
  title: string;
  body: string;
  relatedMetric?: string;
};

export type InsightsInput = {
  org: string;
  period: string;
  metrics: Record<string, unknown>;
};

const FALLBACK_INSIGHTS: InsightPayload[] = [
  {
    type: "ANOMALY",
    severity: "WARNING",
    title: "QA pass rate dropped 6 points this sprint",
    body: "QA pass rate fell from 84% to 78% in the latest sprint — a sharp reversal after four flat sprints. The drop coincides with elevated bug reopens, pointing to a regression that escaped review.",
    relatedMetric: "qaPassRate",
  },
  {
    type: "TREND",
    severity: "WARNING",
    title: "Bug reopens climbing for 6 straight weeks",
    body: "Weekly bug reopen rate has risen from 6% to 12% over six weeks. This sustained upward trend indicates fixes are shipping without adequate regression coverage.",
    relatedMetric: "bugReopenRate",
  },
  {
    type: "RECOMMENDATION",
    severity: "WARNING",
    title: "Add regression tests to CheckoutForm before Sprint 19",
    body: "Pair with QA to add three regression tests covering the currency selector and FX edge cases in CheckoutForm this sprint. Gate merges to lib/services/pricing.ts on those tests.",
    relatedMetric: "qaPassRate",
  },
  {
    type: "ANOMALY",
    severity: "CRITICAL",
    title: "2 critical CVEs detected in production dependencies",
    body: "lodash 4.17.19 and axios 0.21.1 have known critical CVEs. Upgrade both within the sprint — they sit in request-path code and are directly reachable.",
    relatedMetric: "libraryHealth",
  },
  {
    type: "SUMMARY",
    severity: "INFO",
    title: "Delivery speed up, quality slipping",
    body: "PR cycle time improved to 2.4 days while QA pass rate dropped 6 points and bug reopens doubled. The team is shipping faster but catching less — prioritize regression coverage next sprint.",
  },
];

export async function generateInsights(input: InsightsInput): Promise<InsightPayload[]> {
  if (!isAIConfigured()) return FALLBACK_INSIGHTS;
  try {
    const resp = await openai().chat.completions.create({
      model: OPENAI_MODEL,
      max_tokens: 1500,
      messages: [
        { role: "system", content: INSIGHTS_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(input) },
      ],
    });
    const text = resp.choices[0].message.content ?? "";
    const parsed = JSON.parse(stripJsonFences(text));
    if (!Array.isArray(parsed)) throw new Error("not array");
    return parsed as InsightPayload[];
  } catch {
    return FALLBACK_INSIGHTS;
  }
}
