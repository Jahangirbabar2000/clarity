"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Github, BookOpen, FileText, Database, AlertCircle, Activity, Upload, Trash2 } from "lucide-react";
import { formatRelative, formatDate } from "@/lib/utils";
import type { IntegrationStatus } from "@/types/api";

type IntegrationKey = Exclude<IntegrationStatus["type"], "PRD_UPLOAD" | "CI">;

const META: { key: IntegrationKey; name: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
  { key: "GITHUB", name: "GitHub", icon: Github, description: "Fetch PRs, library health, and codebase context." },
  { key: "JIRA", name: "Jira", icon: Database, description: "QA pass rates, bug reopens, and push tickets." },
  { key: "SENTRY", name: "Sentry", icon: AlertCircle, description: "Error trends and top error types." },
  { key: "DATADOG", name: "Datadog", icon: Activity, description: "P95 latency and infra health." },
  { key: "NOTION", name: "Notion", icon: BookOpen, description: "Pull PRD pages into ticket context." },
];

interface PrdUpload { id: string; filename: string; mimeType: string; uploadedAt: string }

export default function ConnectionsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const qc = useQueryClient();

  const { data } = useQuery<{ integrations: IntegrationStatus[] }>({
    queryKey: ["integrations", projectId],
    queryFn: async () => (await fetch(`/api/integrations?projectId=${projectId}`)).json(),
  });

  const { data: prdData } = useQuery<{ prds: PrdUpload[] }>({
    queryKey: ["prds", projectId],
    queryFn: async () => (await fetch(`/api/integrations/prd?projectId=${projectId}`)).json(),
  });

  const connect = useMutation({
    mutationFn: async (p: { type: IntegrationKey; accessToken: string; meta?: Record<string, unknown> }) => {
      await fetch(`/api/integrations?projectId=${projectId}`, { method: "POST", body: JSON.stringify(p), headers: { "Content-Type": "application/json" } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integrations", projectId] }),
  });

  const disconnect = useMutation({
    mutationFn: async (type: IntegrationKey) => {
      await fetch(`/api/integrations?type=${type}&projectId=${projectId}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integrations", projectId] }),
  });

  const fileRef = useRef<HTMLInputElement>(null);

  const uploadPRD = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("projectId", projectId);
      const res = await fetch("/api/integrations/prd", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prds", projectId] }),
  });

  const deletePRD = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/integrations/prd?id=${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prds", projectId] }),
  });

  const prds = prdData?.prds ?? [];

  return (
    <div className="space-y-10">
      {/* Integrations */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Connections</h2>
          <p className="text-sm text-muted-foreground">Connect the tools Clarity reads to build tickets and compute metrics for this project.</p>
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

      {/* PRD Documents */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">PRD Documents</h2>
            <p className="text-sm text-muted-foreground">Upload PDFs or markdown files. Clarity pulls context from all of them when building tickets.</p>
          </div>
          <div>
            <input
              type="file"
              ref={fileRef}
              accept=".pdf,.md,.markdown,text/markdown,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { uploadPRD.mutate(f); e.target.value = ""; }
              }}
            />
            <Button onClick={() => fileRef.current?.click()} disabled={uploadPRD.isPending}>
              <Upload className="h-4 w-4" />
              {uploadPRD.isPending ? "Uploading…" : "Upload PRD"}
            </Button>
          </div>
        </div>

        {prds.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-medium">No PRDs uploaded yet</p>
                <p className="text-sm text-muted-foreground">Upload a PDF or markdown file to give Clarity product context.</p>
              </div>
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" /> Upload your first PRD
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {prds.map((prd) => (
                  <div key={prd.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{prd.filename}</p>
                        <p className="text-xs text-muted-foreground">Uploaded {formatDate(prd.uploadedAt)}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deletePRD.mutate(prd.id)}
                      disabled={deletePRD.isPending}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function IntegrationCard({
  meta, status, onConnect, onDisconnect,
}: {
  meta: (typeof META)[number];
  status?: IntegrationStatus;
  onConnect: (payload: { accessToken: string; meta?: Record<string, unknown> }) => void;
  onDisconnect: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [extra, setExtra] = useState("");
  // Jira-specific fields
  const [jiraBaseUrl, setJiraBaseUrl] = useState("");
  const [jiraEmail, setJiraEmail] = useState("");
  const [jiraProjectKey, setJiraProjectKey] = useState("");
  const connected = status?.connected ?? false;

  const isJira = meta.key === "JIRA";
  const canSave = isJira ? (token && jiraBaseUrl && jiraEmail && jiraProjectKey) : !!token;

  const submit = () => {
    if (isJira) {
      onConnect({
        accessToken: token,
        meta: { baseUrl: jiraBaseUrl.replace(/\/$/, ""), email: jiraEmail, projectKey: jiraProjectKey.toUpperCase() },
      });
    } else {
      const payload: { accessToken: string; meta?: Record<string, unknown> } = { accessToken: token };
      if (extra) payload.meta = meta.key === "GITHUB" ? { repos: extra.split(",").map((s) => s.trim()) } : { key: extra };
      onConnect(payload);
    }
    setOpen(false);
    setToken(""); setExtra(""); setJiraBaseUrl(""); setJiraEmail(""); setJiraProjectKey("");
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
        {connected && (
          <div className="text-xs text-muted-foreground">
            Last synced {formatRelative(status?.lastSyncedAt ?? null)}
            {isJira && status?.meta?.projectKey ? (
              <span className="ml-2 font-medium text-foreground">· {String(status.meta.projectKey)}</span>
            ) : null}
            {meta.key === "GITHUB" && Array.isArray(status?.meta?.repos) ? (
              <span className="ml-2 font-medium text-foreground">· {(status!.meta!.repos as string[]).join(", ")}</span>
            ) : null}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {connected ? (
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
          <DialogHeader><DialogTitle>Connect {meta.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {isJira ? (
              <>
                <div>
                  <label className="text-xs font-medium">Jira Base URL</label>
                  <Input value={jiraBaseUrl} onChange={(e) => setJiraBaseUrl(e.target.value)} placeholder="https://yourcompany.atlassian.net" />
                </div>
                <div>
                  <label className="text-xs font-medium">Jira Email</label>
                  <Input type="email" value={jiraEmail} onChange={(e) => setJiraEmail(e.target.value)} placeholder="you@company.com" />
                </div>
                <div>
                  <label className="text-xs font-medium">API Token</label>
                  <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Jira API token (from id.atlassian.com/manage-profile/security/api-tokens)" />
                </div>
                <div>
                  <label className="text-xs font-medium">Project Key</label>
                  <Input value={jiraProjectKey} onChange={(e) => setJiraProjectKey(e.target.value)} placeholder="PROJ" />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="text-xs font-medium">Access token / API key</label>
                  <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="paste here" />
                </div>
                {meta.key === "GITHUB" && (
                  <div>
                    <label className="text-xs font-medium">Repos (owner/repo format, comma-separated)</label>
                    <Input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="owner/repo, owner/repo2" />
                  </div>
                )}
                {meta.key === "NOTION" && (
                  <div><label className="text-xs font-medium">Workspace ID</label><Input value={extra} onChange={(e) => setExtra(e.target.value)} /></div>
                )}
              </>
            )}
            <div className="flex justify-end gap-2">
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button onClick={submit} disabled={!canSave}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
