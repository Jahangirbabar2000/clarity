import { NextResponse } from "next/server";
import { getPRCycleTime } from "@/lib/integrations/github";
import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");

  let orgName: string | null = url.searchParams.get("orgName");
  let repo: string | null = url.searchParams.get("repo");
  let token: string | null = null;

  if (projectId) {
    const org = await prisma.organization.findUnique({ where: { id: projectId } });
    const ghIntegration = org
      ? await prisma.integration.findFirst({ where: { orgId: org.id, type: "GITHUB" } })
      : null;

    if (ghIntegration) {
      token = ghIntegration.accessToken;
      const repos = (ghIntegration.meta as { repos?: string[] } | null)?.repos ?? [];
      const firstRepo = repos[0] ?? "";
      const [owner, repoName] = firstRepo.split("/");
      orgName = orgName ?? owner ?? org?.githubOrgName ?? null;
      repo = repo ?? repoName ?? null;
    } else if (org?.githubOrgName) {
      orgName = orgName ?? org.githubOrgName;
    }
  }

  if (url.searchParams.get("demo") === "true") {
    const { mockPRCycleTime } = await import("@/lib/integrations/mock-data");
    return NextResponse.json(mockPRCycleTime);
  }

  try {
    return NextResponse.json(await getPRCycleTime(orgName, repo, 56, token));
  } catch {
    return NextResponse.json({ hasData: false, current: null, previous: null, trend: [] });
  }
}
