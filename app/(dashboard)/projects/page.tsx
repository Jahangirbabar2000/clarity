"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Folder, ArrowRight, Sparkles, Trash2 } from "lucide-react";
import { UserSection } from "@/components/layout/TopBar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

interface Project { id: string; name: string; createdAt: string }

export default function ProjectsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null);

  const { data, isLoading } = useQuery<{ projects: Project[] }>({
    queryKey: ["projects"],
    queryFn: async () => {
      const r = await fetch("/api/projects");
      if (r.status === 401) {
        router.replace(`/login?callbackUrl=${encodeURIComponent("/projects")}`);
        return { projects: [] };
      }
      if (!r.ok) throw new Error(`Failed to load projects (${r.status})`);
      const json = await r.json();
      return { projects: Array.isArray(json?.projects) ? json.projects : [] };
    },
  });

  useEffect(() => {
    if (!isLoading && data?.projects?.length === 1) {
      router.replace(`/projects/${data.projects[0].id}/overview`);
    }
  }, [isLoading, data, router]);

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/projects/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      setConfirmDelete(null);
    },
  });

  const projects = data?.projects ?? [];

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

      <main className="flex-1 px-4 py-10">
        <div className="mx-auto max-w-2xl space-y-6">
          {isLoading ? (
            <div className="flex min-h-[40vh] items-center justify-center">
              <p className="text-muted-foreground">Loading projects…</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold">Your Projects</h1>
                  <p className="text-sm text-muted-foreground">Each project has its own integrations, tickets, and metrics.</p>
                </div>
                <Link href="/projects/new">
                  <Button><Plus className="h-4 w-4" /> New Project</Button>
                </Link>
              </div>

              {projects.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                      <Folder className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">No projects yet</p>
                      <p className="text-sm text-muted-foreground">Create your first project to get started.</p>
                    </div>
                    <Link href="/projects/new">
                      <Button><Plus className="h-4 w-4" /> Create Project</Button>
                    </Link>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="grid gap-3">
                    {projects.map((p) => (
                      <Card key={p.id} className="transition-shadow hover:shadow-md">
                        <CardHeader className="flex flex-row items-center justify-between py-4">
                          <Link href={`/projects/${p.id}/overview`} className="flex flex-1 items-center gap-2">
                            <CardTitle className="flex items-center gap-2 text-base">
                              <Folder className="h-4 w-4 text-muted-foreground" />
                              {p.name}
                            </CardTitle>
                          </Link>
                          <div className="flex items-center gap-2">
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={(e) => { e.preventDefault(); setConfirmDelete(p); }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>

                  <Dialog open={Boolean(confirmDelete)} onOpenChange={(o) => !o && setConfirmDelete(null)}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Delete "{confirmDelete?.name}"?</DialogTitle>
                      </DialogHeader>
                      <p className="text-sm text-muted-foreground">This will permanently delete the project and all its tickets, sprints, insights, and integrations. This cannot be undone.</p>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
                        <Button
                          variant="destructive"
                          disabled={deleteProject.isPending}
                          onClick={() => confirmDelete && deleteProject.mutate(confirmDelete.id)}
                        >
                          {deleteProject.isPending ? "Deleting…" : "Delete project"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
