import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const project = await getProjectById(params.projectId, session.user.id);
  if (!project) redirect("/projects");

  await updateLastVisitedProject(session.user.id, params.projectId);

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
