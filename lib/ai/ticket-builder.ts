import { openai, OPENAI_MODEL, isAIConfigured, stripJsonFences } from "./client";
import { TICKET_BUILDER_SYSTEM_PROMPT } from "./prompts";
import type { AssembledContext } from "@/lib/context/context-assembler";
import type { BuildTicketPayload, GeneratedSubtask, GeneratedTicket } from "@/types/api";

const DEMO_FALLBACK: BuildTicketPayload = {
  ticket: {
    title: "Add multi-currency support to checkout flow",
    description:
      "Expand the checkout flow to support purchases in EUR, GBP, JPY, CAD and AUD in addition to USD. Customers see localized pricing, and backend totals are computed in the selected currency at cart-compute time.\n\nThis integrates with the existing pricing engine in lib/services/pricing.ts and the CheckoutForm wizard. FX rates are sourced from the already-cached FX service (1h TTL). Receipt emails are localized via the existing i18n pipeline.\n\nConstraints: tax recalculation is out of scope. Refund flow must continue to operate in the original transaction currency. Assumption: the supported currency list is fixed to the 5 markets above for v1.",
    acceptanceCriteria: [
      "The user can select a currency from a dropdown in the CheckoutForm header",
      "Given a cart in USD, when the user selects EUR, then all line items and totals re-render in EUR within 200ms",
      "Given a selected currency, when the user reloads, then their selection persists via localStorage",
      "The server computes and stores the transaction in the selected currency on order creation",
      "Given a currency with a stale FX rate (>1h), when checkout is submitted, then a fresh rate is fetched before total confirmation",
      "Receipt emails are sent in the transaction currency with locale-appropriate formatting",
    ],
    edgeCases: [
      "User selects a currency with no available FX rate — fall back to USD and surface a toast",
      "FX service is down — block submission and show a retryable error",
      "Cart contains a bundled item priced only in USD — compute a synthetic per-currency price",
      "User changes currency mid-checkout after payment intent created — require re-confirmation",
    ],
    outOfScope: [
      "Tax recalculation per currency / jurisdiction",
      "Refund flow changes (handled in a separate ticket)",
      "Admin-side reporting currency normalization",
    ],
    type: "FEATURE",
    priority: "HIGH",
    storyPoints: 8,
    suggestedLabels: ["payments", "checkout", "frontend", "backend"],
  },
  subtasks: [
    {
      title: "Add currency selector to CheckoutForm header",
      description: "Add a dropdown component to components/CheckoutForm.tsx with the 5 supported currencies. Persist selection in localStorage.",
      type: "FRONTEND",
      storyPoints: 3,
      priority: "HIGH",
      dependsOn: [],
      suggestedSprint: 1,
    },
    {
      title: "Extend pricing service with currency-aware totals",
      description: "Update lib/services/pricing.ts cartTotals() to accept a target currency and convert line items using the FX service.",
      type: "BACKEND",
      storyPoints: 5,
      priority: "HIGH",
      dependsOn: [],
      suggestedSprint: 1,
    },
    {
      title: "Add currency column to Order model",
      description: "Prisma migration: add `currency String @default(\"USD\")` to Order; backfill existing rows.",
      type: "DATABASE",
      storyPoints: 2,
      priority: "HIGH",
      dependsOn: [],
      suggestedSprint: 1,
    },
    {
      title: "Localize receipt email templates",
      description: "Update the receipt template to format amounts using Intl.NumberFormat with the transaction currency and locale.",
      type: "BACKEND",
      storyPoints: 2,
      priority: "MED",
      dependsOn: ["Extend pricing service with currency-aware totals"],
      suggestedSprint: 2,
    },
    {
      title: "Add FX staleness check to checkout handler",
      description: "In app/api/checkout/route.ts, re-fetch FX if cached rate is older than 1h before finalizing the order.",
      type: "BACKEND",
      storyPoints: 3,
      priority: "HIGH",
      dependsOn: ["Extend pricing service with currency-aware totals"],
      suggestedSprint: 2,
    },
    {
      title: "Regression tests for multi-currency cart totals",
      description: "Add unit + integration tests covering currency switch, FX fallback, and bundled-item edge case.",
      type: "TESTING",
      storyPoints: 3,
      priority: "HIGH",
      dependsOn: ["Extend pricing service with currency-aware totals", "Add currency selector to CheckoutForm header"],
      suggestedSprint: 2,
    },
    {
      title: "Datadog tracing for FX latency",
      description: "Add span around FX fetch in checkout handler; alert if p95 > 500ms.",
      type: "INFRA",
      storyPoints: 2,
      priority: "MED",
      dependsOn: ["Add FX staleness check to checkout handler"],
      suggestedSprint: 3,
    },
  ],
};

export async function buildTicket(idea: string, context: AssembledContext): Promise<BuildTicketPayload> {
  if (!isAIConfigured()) return DEMO_FALLBACK;
  try {
    const resp = await openai().chat.completions.create({
      model: OPENAI_MODEL,
      max_tokens: 4000,
      messages: [
        { role: "system", content: TICKET_BUILDER_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify({ idea, context }) },
      ],
    });
    const text = resp.choices[0].message.content ?? "";
    const parsed = JSON.parse(stripJsonFences(text)) as {
      ticket: GeneratedTicket;
      subtasks: GeneratedSubtask[];
    };
    return parsed;
  } catch {
    return DEMO_FALLBACK;
  }
}

export async function buildTicketStream(
  idea: string,
  context: AssembledContext,
  onChunk: (chunk: string) => void,
): Promise<BuildTicketPayload> {
  if (!isAIConfigured()) {
    const text = JSON.stringify(DEMO_FALLBACK, null, 2);
    for (let i = 0; i < text.length; i += 64) {
      onChunk(text.slice(i, i + 64));
      await new Promise((r) => setTimeout(r, 15));
    }
    return DEMO_FALLBACK;
  }

  let full = "";
  const stream = await openai().chat.completions.create({
    model: OPENAI_MODEL,
    max_tokens: 4000,
    stream: true,
    messages: [
      { role: "system", content: TICKET_BUILDER_SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify({ idea, context }) },
    ],
  });
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      full += delta;
      onChunk(delta);
    }
  }
  try {
    return JSON.parse(stripJsonFences(full)) as BuildTicketPayload;
  } catch {
    return DEMO_FALLBACK;
  }
}
