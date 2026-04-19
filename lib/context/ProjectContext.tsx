"use client";

import { createContext, useContext } from "react";

interface Project {
  id: string;
  name: string;
  jiraProjectKey: string | null;
  githubOrgName: string | null;
  jiraDomain: string | null;
}

interface ProjectContextValue {
  project: Project;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ project, children }: { project: Project; children: React.ReactNode }) {
  return <ProjectContext.Provider value={{ project }}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used within a ProjectProvider");
  return ctx.project;
}
