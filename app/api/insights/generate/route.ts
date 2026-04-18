import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { ensureDemoOrg } from "@/lib/db/queries";
import { healthAnalystAgent, type AgentEvent } from "@/lib/ai/agents";
import { getQAPassRate, getBugReopenRate, getSprintVelocity } from "@/lib/integrations/jira";
import { getPRCycleTime, getLibraryHealth } from "@/lib/integrations/github";
import { getTopErrors } from "@/lib/integrations/sentry";
import { mockBuildHealth } from "@/lib/integrations/mock-data";

const bodySchema = z.object({ orgId: z.string().optional() });

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Bad input" }, { status: 400 });

  const org = parsed.data.orgId
    ? await prisma.organization.findUnique({ where: { id: parsed.data.orgId } })
    : await ensureDemoOrg();
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  const [qa, bug, pr, velocity, lib, topErrors] = await Promise.all([
    getQAPassRate(org.jiraProjectKey ?? "CLAR"),
    getBugReopenRate(org.jiraProjectKey ?? "CLAR"),
    getPRCycleTime(org.githubOrgName, null),
    getSprintVelocity(org.jiraProjectKey ?? "CLAR"),
    getLibraryHealth(org.githubOrgName, null),
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
          current: mockBuildHealth.current,
          previous: mockBuildHealth.previous,
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
  const orgId = url.searchParams.get("orgId");
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
