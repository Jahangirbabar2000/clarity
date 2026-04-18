"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { ExternalLink, Rocket } from "lucide-react";

export function PushToJiraButton({
  ticketId,
  subtaskCount,
  onPushed,
  jiraUrl,
  alreadyPushed,
}: {
  ticketId: string;
  subtaskCount: number;
  onPushed?: (urls: { parentJiraUrl: string; subtaskUrls: { subtaskId: string; url: string }[] }) => void;
  jiraUrl?: string | null;
  alreadyPushed?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<null | { parentJiraUrl: string; subtaskUrls: { subtaskId: string; url: string }[] }>(null);

  if (alreadyPushed && jiraUrl) {
    return (
      <Button variant="outline" asChild>
        <a href={jiraUrl} target="_blank" rel="noreferrer">
          <ExternalLink className="h-4 w-4" /> View in Jira
        </a>
      </Button>
    );
  }

  const push = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/workspace/push-to-jira", {
        method: "POST",
        body: JSON.stringify({ ticketId }),
      });
      const data = await r.json();
      setResult(data);
      onPushed?.(data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Rocket className="h-4 w-4" /> Push to Jira
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          {result ? (
            <div className="space-y-3">
              <DialogHeader>
                <DialogTitle>Pushed to Jira</DialogTitle>
                <DialogDescription>Parent issue and {result.subtaskUrls.length} subtasks created.</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 rounded-md border p-3 text-sm">
                <a href={result.parentJiraUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                  <ExternalLink className="h-3 w-3" /> Parent issue
                </a>
                {result.subtaskUrls.map((u) => (
                  <a key={u.subtaskId} href={u.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-muted-foreground hover:underline">
                    <ExternalLink className="h-3 w-3" /> {u.url.split("/").pop()}
                  </a>
                ))}
              </div>
              <div className="flex justify-end">
                <DialogClose asChild>
                  <Button variant="outline">Close</Button>
                </DialogClose>
              </div>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Push to Jira?</DialogTitle>
                <DialogDescription>
                  This will create 1 parent issue and {subtaskCount} subtasks in your Jira project. The ticket status will move to <b>PUSHED</b>.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="outline" disabled={loading}>Cancel</Button>
                </DialogClose>
                <Button onClick={push} disabled={loading}>
                  <Rocket className="h-4 w-4" /> {loading ? "Pushing…" : "Confirm & push"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
