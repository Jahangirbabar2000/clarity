"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select } from "@/components/ui/select";
import { Sparkles, ExternalLink } from "lucide-react";
import { formatDate } from "@/lib/utils";

type TicketRow = {
  id: string; title: string; type: string; priority: string; status: string;
  storyPoints: number | null; jiraUrl: string | null; createdAt: string;
  subtasks: { id: string }[]; sprintAssignments: { sprintId: string }[];
};

export default function WorkspacePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [filterType, setFilterType] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");

  const { data, isLoading } = useQuery<{ tickets: TicketRow[] }>({
    queryKey: ["workspace", "tickets", projectId],
    queryFn: async () => {
      const r = await fetch(`/api/workspace/tickets?projectId=${projectId}`);
      if (!r.ok) throw new Error();
      return r.json();
    },
  });

  const tickets = (data?.tickets ?? []).filter((t) => {
    if (filterType !== "ALL" && t.type !== filterType) return false;
    if (filterStatus !== "ALL" && t.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Workspace</h2>
          <p className="text-sm text-muted-foreground">All tickets built in Clarity. Click any row to edit inline.</p>
        </div>
        <Link href={`/projects/${projectId}/workspace/new`}>
          <Button><Sparkles className="h-4 w-4" /> New ticket</Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={filterType} onChange={setFilterType} options={[{ value: "ALL", label: "All types" }, { value: "FEATURE", label: "Feature" }, { value: "BUG", label: "Bug" }, { value: "IMPROVEMENT", label: "Improvement" }, { value: "SPIKE", label: "Spike" }]} />
        <Select value={filterStatus} onChange={setFilterStatus} options={[{ value: "ALL", label: "All statuses" }, { value: "DRAFT", label: "Draft" }, { value: "REVIEWED", label: "Reviewed" }, { value: "PUSHED", label: "Pushed" }]} />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <p className="text-sm text-muted-foreground">No tickets yet. Turn an idea into a ticket.</p>
              <Link href={`/projects/${projectId}/workspace/new`}><Button><Sparkles className="h-4 w-4" /> Create first ticket</Button></Link>
            </div>
          ) : (
            <div className="divide-y">
              <div className="hidden grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
                <div className="col-span-5">Title</div><div className="col-span-1">Type</div><div className="col-span-1">Priority</div>
                <div className="col-span-1">Pts</div><div className="col-span-1">Subtasks</div><div className="col-span-1">Status</div><div className="col-span-2">Created</div>
              </div>
              {tickets.map((t) => (
                <Link key={t.id} href={`/projects/${projectId}/workspace/${t.id}`} className="grid grid-cols-2 gap-2 px-4 py-3 text-sm transition-colors hover:bg-accent/40 md:grid-cols-12 md:items-center">
                  <div className="col-span-2 font-medium md:col-span-5">{t.title}</div>
                  <div className="md:col-span-1"><Badge variant="outline">{t.type}</Badge></div>
                  <div className="md:col-span-1"><Badge variant={t.priority === "HIGH" ? "destructive" : t.priority === "LOW" ? "secondary" : "warning"}>{t.priority}</Badge></div>
                  <div className="text-muted-foreground md:col-span-1">{t.storyPoints ?? "—"}</div>
                  <div className="text-muted-foreground md:col-span-1">{t.subtasks.length}</div>
                  <div className="md:col-span-1"><Badge variant={t.status === "PUSHED" ? "success" : t.status === "REVIEWED" ? "info" : "secondary"}>{t.status}</Badge></div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground md:col-span-2">
                    <span>{formatDate(t.createdAt)}</span>
                    {t.jiraUrl ? <a href={t.jiraUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 text-primary hover:underline"><ExternalLink className="h-3 w-3" /></a> : null}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
