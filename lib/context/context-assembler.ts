import { prisma } from "@/lib/db/client";
import { getRepoFileSummaries } from "@/lib/integrations/github";
import { getRecentTicketTitles } from "@/lib/integrations/jira";
import { getNotionPages } from "@/lib/integrations/notion";
import { getLatestPRD } from "@/lib/integrations/prd-parser";

export type AssembledContext = {
  techStack: string[];
  existingServices: string[];
  relevantFiles: { path: string; summary: string }[];
  recentTicketTitles: string[];
  jiraStyleSamples: string[];
  prdExcerpt: string;
  notionExcerpt: string;
  sources: {
    github: boolean;
    jira: boolean;
    notion: boolean;
    prd: boolean;
    existingTickets: number;
  };
};

const LIMITS = {
  ghFileChars: 1500,
  ghFiles: 10,
  jiraTitleChars: 200,
  jiraTickets: 20,
  notionChars: 3000,
  notionPages: 5,
  prdChars: 8000,
  existingTitleChars: 100,
  existingTickets: 50,
};

function truncate(s: string, n: number) {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

export async function assembleContext(orgId: string): Promise<AssembledContext> {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  const integrations = await prisma.integration.findMany({ where: { orgId } });
  const hasIntegration = (t: string) => integrations.some((i) => i.type === t);

  const [filesRaw, jiraTitlesRaw, notionPagesRaw, prd, existingTickets] = await Promise.all([
    getRepoFileSummaries(org?.githubOrgName ?? null, null, LIMITS.ghFiles),
    getRecentTicketTitles(org?.jiraProjectKey ?? "CLAR", LIMITS.jiraTickets),
    getNotionPages([]),
    getLatestPRD(orgId),
    prisma.ticket.findMany({
      where: { orgId },
      select: { title: true, type: true },
      orderBy: { updatedAt: "desc" },
      take: LIMITS.existingTickets,
    }),
  ]);

  const relevantFiles = filesRaw.slice(0, LIMITS.ghFiles).map((f) => ({
    path: f.path,
    summary: truncate(f.summary, LIMITS.ghFileChars),
  }));

  const recentTicketTitles = existingTickets.map((t) => truncate(t.title, LIMITS.existingTitleChars));
  const jiraStyleSamples = jiraTitlesRaw.slice(0, LIMITS.jiraTickets).map((t) => truncate(t, LIMITS.jiraTitleChars));

  const notionText = notionPagesRaw
    .slice(0, LIMITS.notionPages)
    .map((p) => `## ${p.title}\n${truncate(p.text, LIMITS.notionChars)}`)
    .join("\n\n");

  const prdExcerpt = prd ? truncate(prd.extracted, LIMITS.prdChars) : "";

  const techStack = inferTechStack(relevantFiles);
  const existingServices = inferServices(relevantFiles);

  return {
    techStack,
    existingServices,
    relevantFiles,
    recentTicketTitles,
    jiraStyleSamples,
    prdExcerpt,
    notionExcerpt: notionText,
    sources: {
      github: hasIntegration("GITHUB") || relevantFiles.length > 0,
      jira: hasIntegration("JIRA") || jiraStyleSamples.length > 0,
      notion: hasIntegration("NOTION") || notionPagesRaw.length > 0,
      prd: Boolean(prd),
      existingTickets: existingTickets.length,
    },
  };
}

function inferTechStack(files: { path: string; summary: string }[]) {
  const stack = new Set<string>();
  for (const f of files) {
    if (f.path.endsWith(".ts") || f.path.endsWith(".tsx")) stack.add("TypeScript");
    if (f.path.endsWith(".tsx")) stack.add("React");
    if (f.path.includes("prisma")) stack.add("Prisma");
    if (f.path.includes("app/api")) stack.add("Next.js");
    if (f.path.includes("stripe") || f.summary.toLowerCase().includes("stripe")) stack.add("Stripe");
    if (f.summary.toLowerCase().includes("datadog")) stack.add("Datadog");
  }
  return [...stack];
}

function inferServices(files: { path: string; summary: string }[]) {
  return [...new Set(files.map((f) => f.path.split("/")[0]))];
}
