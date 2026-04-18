"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Github, BookOpen, FileText, Database, AlertCircle, Activity, Upload } from "lucide-react";
import { formatRelative } from "@/lib/utils";
import { AIRoutingPanel } from "@/components/settings/AIRoutingPanel";
import type { IntegrationStatus } from "@/types/api";

type IntegrationKey = IntegrationStatus["type"];

const META: { key: IntegrationKey; name: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
  { key: "GITHUB", name: "GitHub", icon: Github, description: "Fetch PRs, library health, and codebase context." },
  { key: "JIRA", name: "Jira", icon: Database, description: "QA pass rates, bug reopens, and push tickets." },
  { key: "SENTRY", name: "Sentry", icon: AlertCircle, description: "Error trends and top error types." },
  { key: "DATADOG", name: "Datadog", icon: Activity, description: "P95 latency and infra health." },
  { key: "NOTION", name: "Notion", icon: BookOpen, description: "Pull PRD pages into ticket context." },
  { key: "PRD_UPLOAD", name: "PRD Upload", icon: FileText, description: "Upload PDF or markdown PRDs." },
];

export default function SettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery<{ integrations: IntegrationStatus[] }>({
    queryKey: ["integrations"],
    queryFn: async () => (await fetch("/api/integrations")).json(),
  });

  const connect = useMutation({
    mutationFn: async (p: { type: IntegrationKey; accessToken: string; meta?: Record<string, unknown> }) => {
      await fetch("/api/integrations", { method: "POST", body: JSON.stringify(p), headers: { "Content-Type": "application/json" } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integrations"] }),
  });

  const disconnect = useMutation({
    mutationFn: async (type: IntegrationKey) => {
      await fetch(`/api/integrations?type=${type}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integrations"] }),
  });

  return (
    <div className="space-y-8">
      <AIRoutingPanel />

      <div>
        <h2 className="text-xl font-semibold">Integrations</h2>
        <p className="text-sm text-muted-foreground">Connect the sources Clarity reads to build tickets and compute metrics.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {META.map((i) => {
          const status = data?.integrations.find((s) => s.type === i.key);
          return (
            <IntegrationCard
              key={i.key}
              meta={i}
              status={status}
              onConnect={(payload) => connect.mutate({ type: i.key, ...payload })}
              onDisconnect={() => disconnect.mutate(i.key)}
            />
          );
        })}
      </div>
    </div>
  );
}

function IntegrationCard({
  meta,
  status,
  onConnect,
  onDisconnect,
}: {
  meta: (typeof META)[number];
  status?: IntegrationStatus;
  onConnect: (payload: { accessToken: string; meta?: Record<string, unknown> }) => void;
  onDisconnect: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [extra, setExtra] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const connected = status?.connected ?? false;

  const submit = () => {
    if (meta.key === "PRD_UPLOAD") return;
    const payload: { accessToken: string; meta?: Record<string, unknown> } = { accessToken: token };
    if (extra) payload.meta = meta.key === "GITHUB" ? { repos: extra.split(",").map((s) => s.trim()) } : { key: extra };
    onConnect(payload);
    setOpen(false);
    setToken("");
    setExtra("");
  };

  const uploadPRD = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    await fetch("/api/integrations/prd", { method: "POST", body: fd });
    onConnect({ accessToken: "file", meta: { filename: file.name } });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-accent p-2"><meta.icon className="h-4 w-4" /></div>
          <div>
            <CardTitle className="text-base">{meta.name}</CardTitle>
            <p className="text-xs text-muted-foreground">{meta.description}</p>
          </div>
        </div>
        <Badge variant={connected ? "success" : "secondary"}>{connected ? "Connected" : "Not connected"}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {connected ? (
          <div className="text-xs text-muted-foreground">
            Last synced {formatRelative(status?.lastSyncedAt ?? null)}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {meta.key === "PRD_UPLOAD" ? (
            <>
              <input
                type="file"
                ref={fileRef}
                accept=".pdf,.md,.markdown,text/markdown,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadPRD(f);
                }}
              />
              <Button size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="h-3.5 w-3.5" /> Upload PRD
              </Button>
            </>
          ) : connected ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Reconnect</Button>
              <Button size="sm" variant="ghost" onClick={onDisconnect}>Disconnect</Button>
            </>
          ) : (
            <Button size="sm" onClick={() => setOpen(true)}>Connect</Button>
          )}
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect {meta.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Access token / API key</label>
              <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="paste here" />
            </div>
            {meta.key === "GITHUB" ? (
              <div>
                <label className="text-xs font-medium">Repos (comma-separated)</label>
                <Input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="owner/repo, owner/repo2" />
              </div>
            ) : meta.key === "NOTION" ? (
              <div>
                <label className="text-xs font-medium">Workspace ID</label>
                <Input value={extra} onChange={(e) => setExtra(e.target.value)} />
              </div>
            ) : null}
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={submit} disabled={!token}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
