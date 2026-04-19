"use client";

import { AIRoutingPanel } from "@/components/settings/AIRoutingPanel";
import { AIUsagePanel } from "@/components/settings/AIUsagePanel";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">Global AI routing and usage. Per-project integrations are in each project's Connections page.</p>
      </div>
      <AIRoutingPanel />
      <AIUsagePanel />
    </div>
  );
}
