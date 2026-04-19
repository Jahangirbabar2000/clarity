import { NextResponse } from "next/server";
import { getLibraryHealth } from "@/lib/integrations/github";
import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");

  let orgName: string | null = url.searchParams.get("orgName");
  let repo: string | null = url.searchParams.get("repo");

  if (projectId) {
    const org = await prisma.organization.findUnique({ where: { id: projectId } });
    const ghIntegration = org
      ? await prisma.integration.findFirst({ where: { orgId: org.id, type: "GITHUB" } })
      : null;

    if (ghIntegration) {
      const repos = (ghIntegration.meta as { repos?: string[] } | null)?.repos ?? [];
      const [owner, repoName] = (repos[0] ?? "").split("/");
      orgName = orgName ?? owner ?? org?.githubOrgName ?? null;
      repo = repo ?? repoName ?? null;
    } else if (org?.githubOrgName) {
      orgName = orgName ?? org.githubOrgName;
    }
  }

  if (url.searchParams.get("demo") === "true") {
    const { mockLibraryHealth } = await import("@/lib/integrations/mock-data");
    return NextResponse.json(mockLibraryHealth);
  }

  try {
    return NextResponse.json(await getLibraryHealth(orgName, repo));
  } catch {
    return NextResponse.json({ hasData: false, upToDate: 0, minorUpdates: 0, criticalCVEs: 0, sample: [] });
  }
}
