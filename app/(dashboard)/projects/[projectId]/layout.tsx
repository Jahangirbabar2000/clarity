import { redirect } from "next/navigation";
import { getEffectiveUserId } from "@/lib/auth/demo-user";
import { getProjectById, updateLastVisitedProject } from "@/lib/db/queries";
import { ProjectProvider } from "@/lib/context/ProjectContext";
import { ProjectSidebar, ProjectMobileTabBar } from "@/components/layout/ProjectSidebar";
import { TopBar } from "@/components/layout/TopBar";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { projectId: string };
}) {
  const userId = await getEffectiveUserId();
  if (!userId) redirect("/login");

  const project = await getProjectById(params.projectId, userId);
  if (!project) redirect("/projects");

  await updateLastVisitedProject(userId, params.projectId);

  return (
    <ProjectProvider project={project}>
      <div className="flex min-h-screen">
        <ProjectSidebar project={project} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar title={project.name} />
          <main className="flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6">{children}</main>
        </div>
        <ProjectMobileTabBar projectId={params.projectId} />
      </div>
    </ProjectProvider>
  );
}
