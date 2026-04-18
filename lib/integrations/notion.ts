import { USE_MOCKS } from "@/lib/utils";

export async function getNotionPages(_pageIds: string[] = []) {
  if (USE_MOCKS || !process.env.NOTION_API_KEY) {
    return [
      {
        id: "demo-1",
        title: "Checkout v2 — PRD",
        text: "Goal: support multi-currency checkout across the top 8 markets. Success: GMV per market trends up within 1 sprint of launch. Scope: currency selector, FX conversion at cart-compute, receipt localization. Non-goals: tax recalculation, refund flow changes.",
      },
      {
        id: "demo-2",
        title: "Pricing engine — discovery notes",
        text: "Tier-based pricing logic lives in lib/services/pricing.ts. FX rates cached for 1h; need invalidation on rate spike. Bundled-item total bug traced to rounding in cartTotals(). Team owner: Payments squad. Related Linear: PAY-482.",
      },
    ];
  }
  return [];
}
