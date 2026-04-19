import { NextResponse } from "next/server";
import { getQAPassRate, type JiraCreds } from "@/lib/integrations/jira";
import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  const n = Number(url.searchParams.get("n") ?? 8);

  let projectKey = url.searchParams.get("projectKey") ?? "CLAR";
  let creds: JiraCreds | null = null;

  if (projectId) {
    const org = await prisma.organization.findUnique({ where: { id: projectId } });
    const integration = org
      ? await prisma.integration.findFirst({ where: { orgId: org.id, type: "JIRA" } })
      : null;
    if (integration) {
      const meta = integration.meta as { baseUrl?: string; email?: string; projectKey?: string } | null;
      if (meta?.baseUrl && meta?.email) {
        creds = { baseUrl: meta.baseUrl, email: meta.email, token: integration.accessToken };
      }
      projectKey = meta?.projectKey ?? org?.jiraProjectKey ?? projectKey;
    } else if (org?.jiraProjectKey) {
      projectKey = org.jiraProjectKey;
    }
  }

  if (url.searchParams.get("demo") === "true") {
    const { mockQAPassRate } = await import("@/lib/integrations/mock-data");
    return NextResponse.json(mockQAPassRate);
  }

  try {
    return NextResponse.json(await getQAPassRate(projectKey, n, creds));
  } catch {
    return NextResponse.json({ hasData: false, current: null, previous: null, trend: [] });
  }
}
