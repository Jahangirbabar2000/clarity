"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { UserSection } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Github, Database, AlertCircle, Activity, BookOpen, FileText, Check, ChevronRight, Sparkles } from "lucide-react";

type IntegrationKey = "GITHUB" | "JIRA" | "SENTRY" | "DATADOG" | "NOTION" | "PRD_UPLOAD";

const INTEGRATIONS: { key: IntegrationKey; name: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
  { key: "GITHUB", name: "GitHub", icon: Github, description: "PRs, library health, codebase context" },
  { key: "JIRA", name: "Jira", icon: Database, description: "QA rates, bug reopens, push tickets" },
  { key: "SENTRY", name: "Sentry", icon: AlertCircle, description: "Error trends and top issues" },
  { key: "DATADOG", name: "Datadog", icon: Activity, description: "P95 latency and infra health" },
  { key: "NOTION", name: "Notion", icon: BookOpen, description: "Pull PRD pages into context" },
];

const STEPS = ["Name your project", "Connect integrations", "You're all set"];

export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [connectedTokens, setConnectedTokens] = useState<Record<string, string>>({});
  const [activeIntegration, setActiveIntegration] = useState<IntegrationKey | null>(null);
  const [token, setToken] = useState("");
  const [extra, setExtra] = useState("");

  const createProject = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      return data.project as { id: string };
    },
    onSuccess: (project) => {
      setProjectId(project.id);
      setStep(1);
    },
  });

  const connectIntegration = useMutation({
    mutationFn: async ({ type, accessToken, meta }: { type: IntegrationKey; accessToken: string; meta?: Record<string, unknown> }) => {
      await fetch(`/api/integrations?projectId=${projectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, accessToken, meta }),
      });
    },
    onSuccess: () => {
      setConnectedTokens((prev) => ({ ...prev, [activeIntegration!]: token }));
      setActiveIntegration(null);
      setToken("");
      setExtra("");
    },
  });

  const handleConnect = () => {
    if (!activeIntegration || !projectId) return;
    const meta: Record<string, unknown> | undefined = extra
      ? activeIntegration === "GITHUB"
        ? { repos: extra.split(",").map((s) => s.trim()) }
        : { key: extra }
      : undefined;
    connectIntegration.mutate({ type: activeIntegration, accessToken: token || "placeholder", meta });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center justify-between border-b bg-card px-4">
        <Link href="/projects" className="flex items-center gap-2 font-semibold">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          Clarity
        </Link>
        <UserSection />
      </header>
    <div className="mx-auto max-w-xl space-y-6 py-10 px-4">
      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${i < step ? "bg-primary text-primary-foreground" : i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {i < step ? <Check className="h-3 w-3" /> : i + 1}
            </div>
            <span className={`text-sm ${i === step ? "font-medium" : "text-muted-foreground"}`}>{label}</span>
            {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {/* Step 0: Name */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>What are you building?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Project name</label>
              <Input
                className="mt-1"
                placeholder="e.g. Clarity App, Mobile v2, Backend API"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && name.trim() && createProject.mutate()}
              />
            </div>
            <Button
              className="w-full"
              disabled={!name.trim() || createProject.isPending}
              onClick={() => createProject.mutate()}
            >
              {createProject.isPending ? "Creating…" : "Continue"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Integrations */}
      {step === 1 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Connect your tools</CardTitle>
              <p className="text-sm text-muted-foreground">Connect integrations to get real data. You can skip any and add them later from the project.</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {INTEGRATIONS.map((intg) => {
                const connected = Boolean(connectedTokens[intg.key]);
                const isActive = activeIntegration === intg.key;
                return (
                  <div key={intg.key} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <intg.icon className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{intg.name}</p>
                          <p className="text-xs text-muted-foreground">{intg.description}</p>
                        </div>
                      </div>
                      {connected ? (
                        <Badge variant="success">Connected</Badge>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setActiveIntegration(isActive ? null : intg.key)}>
                          {isActive ? "Cancel" : "Connect"}
                        </Button>
                      )}
                    </div>
                    {isActive && intg.key !== "PRD_UPLOAD" && (
                      <div className="mt-3 space-y-2 border-t pt-3">
                        <Input placeholder="Access token / API key" value={token} onChange={(e) => setToken(e.target.value)} />
                        {intg.key === "GITHUB" && (
                          <Input placeholder="Repos (comma-separated): owner/repo" value={extra} onChange={(e) => setExtra(e.target.value)} />
                        )}
                        {intg.key === "NOTION" && (
                          <Input placeholder="Workspace ID" value={extra} onChange={(e) => setExtra(e.target.value)} />
                        )}
                        <Button size="sm" disabled={!token || connectIntegration.isPending} onClick={handleConnect}>
                          {connectIntegration.isPending ? "Saving…" : "Save"}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>Skip for now</Button>
            <Button className="flex-1" onClick={() => setStep(2)}>Continue</Button>
          </div>
        </div>
      )}

      {/* Step 2: Done */}
      {step === 2 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Sparkles className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{name} is ready!</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {Object.keys(connectedTokens).length > 0
                  ? `${Object.keys(connectedTokens).length} integration(s) connected.`
                  : "You can connect integrations anytime from the project."}
              </p>
            </div>
            <Button className="w-full" onClick={() => router.push(`/projects/${projectId}/overview`)}>
              Open project →
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
    </div>
  );
}
