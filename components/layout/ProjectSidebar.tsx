"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Activity, Home, Lightbulb, Settings, Sparkles, Layers,
  ClipboardList, Plug, ChevronDown, FolderOpen, Plus, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

function buildNav(projectId: string) {
  return [
    { href: `/projects/${projectId}/overview`, label: "Overview", icon: Home },
    { href: `/projects/${projectId}/health`, label: "Health", icon: Activity },
    { href: `/projects/${projectId}/insights`, label: "Insights", icon: Lightbulb },
    { href: `/projects/${projectId}/workspace`, label: "Workspace", icon: ClipboardList },
    { href: `/projects/${projectId}/sprints`, label: "Sprints", icon: Layers },
    { href: `/projects/${projectId}/connections`, label: "Connections", icon: Plug },
  ];
}

interface Project { id: string; name: string }

function ProjectSwitcher({ current }: { current: Project }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { data } = useQuery<{ projects: Project[] }>({
    queryKey: ["projects"],
    queryFn: () => fetch("/api/projects").then((r) => r.json()),
  });

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent/50"
      >
        <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate text-left">{current.name}</span>
        <ChevronDown className={cn("h-3 w-3 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border bg-card p-1 shadow-lg">
          {data?.projects.map((p) => (
            <button
              key={p.id}
              onClick={() => { router.push(`/projects/${p.id}/overview`); setOpen(false); }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
            >
              {p.id === current.id && <Check className="h-3 w-3 text-primary" />}
              <span className={cn("truncate", p.id !== current.id && "pl-5")}>{p.name}</span>
            </button>
          ))}
          <div className="my-1 border-t" />
          <Link
            href="/projects/new"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
          >
            <Plus className="h-3 w-3" /> New project
          </Link>
        </div>
      )}
    </div>
  );
}

export function ProjectSidebar({ project }: { project: Project }) {
  const pathname = usePathname();
  const nav = buildNav(project.id);

  return (
    <aside className="hidden w-56 shrink-0 border-r bg-card md:flex md:flex-col">
      <Link href="/projects" className="flex h-14 items-center gap-2 border-b px-4 font-semibold">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </div>
        Clarity
      </Link>
      <div className="border-b p-2">
        <ProjectSwitcher current={project} />
      </div>
      <nav className="flex flex-col gap-0.5 p-2">
        {nav.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t p-2">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
            pathname.startsWith("/settings") ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
          )}
        >
          <Settings className="h-4 w-4" /> Settings
        </Link>
      </div>
    </aside>
  );
}

export function ProjectMobileTabBar({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const nav = buildNav(projectId).filter((n) => n.label !== "Connections");

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-card md:hidden">
      {nav.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn("flex flex-col items-center justify-center gap-1 py-2 text-xs", active ? "text-foreground" : "text-muted-foreground")}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
