import { InsightFeed } from "@/components/insights/InsightFeed";

export default function InsightsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">AI Insights</h2>
        <p className="text-sm text-muted-foreground">Anomalies, trends and recommendations generated from your engineering metrics.</p>
      </div>
      <InsightFeed />
    </div>
  );
}
