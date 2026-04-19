import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { ensureDemoOrg } from "@/lib/db/queries";
import { healthAnalystAgent, type AgentEvent } from "@/lib/ai/agents";
import { getQAPassRate, getBugReopenRate, getSprintVelocity, type JiraCreds } from "@/lib/integrations/jira";
import { getPRCycleTime, getLibraryHealth } from "@/lib/integrations/github";
import { getTopErrors } from "@/lib/integrations/sentry";

const bodySchema = z.object({ orgId: z.string().optional() });

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Bad input" }, { status: 400 });

  const url = new URL((req as Request & { url: string }).url);
  const projectId = url.searchParams.get("projectId") ?? parsed.data.orgId;
  const org = projectId
    ? await prisma.organization.findUnique({ where: { id: projectId } })
    : await ensureDemoOrg();
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  const [jiraIntegration, ghIntegration] = await Promise.all([
    prisma.integration.findFirst({ where: { orgId: org.id, type: "JIRA" } }),
    prisma.integration.findFirst({ where: { orgId: org.id, type: "GITHUB" } }),
  ]);

  const jiraMeta = jiraIntegration?.meta as { baseUrl?: string; email?: string; projectKey?: string } | null;
  const jiraCreds: JiraCreds | null = jiraMeta?.baseUrl && jiraMeta?.email
    ? { baseUrl: jiraMeta.baseUrl, email: jiraMeta.email, token: jiraIntegration!.accessToken }
    : null;
  const jiraProjectKey = jiraMeta?.projectKey ?? org.jiraProjectKey ?? "CLAR";

  const ghToken = ghIntegration?.accessToken ?? null;
  const ghRepos = (ghIntegration?.meta as { repos?: string[] } | null)?.repos ?? [];
  const [ghOwner, ghRepo] = (ghRepos[0] ?? "").split("/");
  const ghOrgName = ghOwner || org.githubOrgName;

  const [qa, bug, pr, velocity, lib, topErrors] = await Promise.all([
    getQAPassRate(jiraProjectKey, 8, jiraCreds),
    getBugReopenRate(jiraProjectKey, 56, jiraCreds),
    getPRCycleTime(ghOrgName ?? null, ghRepo ?? null, 56, ghToken),
    getSprintVelocity(jiraProjectKey, 6, jiraCreds),
    getLibraryHealth(ghOrgName ?? null, ghRepo ?? null),
    getTopErrors(org.sentryOrg ?? "demo", "demo"),
  ]);

  const agentTrace: AgentEvent[] = [];
  const insights = await healthAnalystAgent.run(
    {
      org: org.name,
      period: "last 8 sprints",
      metrics: {
        qaPassRate: {
          current: qa.current,
          previous: qa.previous,
          trend: qa.trend.map((t) => t.value),
        },
        bugReopenRate: {
          current: bug.current,
          previous: bug.previous,
          trend: bug.trend.map((t) => t.value),
        },
        prCycleTime: {
          current: pr.current,
          unit: "days",
          trend: pr.trend.map((t) => t.value),
        },
        buildFailureRate: {
          current: null,
          previous: null,
        },
        libraryHealth: {
          upToDate: lib.upToDate,
          minorUpdates: lib.minorUpdates,
          criticalCVEs: lib.criticalCVEs,
        },
        velocity: {
          committed: velocity.committed,
          delivered: velocity.delivered,
          trend: velocity.trend,
        },
        topErrors,
      },
    },
    { emit: (e) => agentTrace.push(e) },
  );

  const saved = await prisma.$transaction(
    insights.map((i) =>
      prisma.aIInsight.create({
        data: {
          orgId: org.id,
          type: i.type,
          severity: i.severity,
          title: i.title,
          body: i.body,
          relatedMetric: i.relatedMetric,
        },
      }),
    ),
  );

  return NextResponse.json({ insights: saved, agentTrace });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const orgId = url.searchParams.get("projectId") ?? url.searchParams.get("orgId");
  const limit = Number(url.searchParams.get("limit") ?? 20);
  const org = orgId
    ? await prisma.organization.findUnique({ where: { id: orgId } })
    : await ensureDemoOrg();
  if (!org) return NextResponse.json({ insights: [] });
  const insights = await prisma.aIInsight.findMany({
    where: { orgId: org.id },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return NextResponse.json({ insights });
}
