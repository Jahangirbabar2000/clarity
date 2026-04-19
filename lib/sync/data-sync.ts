import { Queue, QueueEvents } from "bullmq";
import IORedis from "ioredis";
import { prisma } from "@/lib/db/client";
import { getPRCycleTime } from "@/lib/integrations/github";
import { getQAPassRate, getBugReopenRate, type JiraCreds } from "@/lib/integrations/jira";

export const SYNC_QUEUE = "clarity-sync";

let connection: IORedis | null = null;
let queue: Queue | null = null;

function getConnection(): IORedis | null {
  if (connection) return connection;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  connection = new IORedis(url, { maxRetriesPerRequest: null });
  return connection;
}

export function getQueue(): Queue | null {
  if (queue) return queue;
  const conn = getConnection();
  if (!conn) return null;
  queue = new Queue(SYNC_QUEUE, { connection: conn });
  return queue;
}

export async function queueSync(orgId: string | null) {
  const q = getQueue();
  if (!q) {
    const result = await runSyncDirect(orgId);
    return { mode: "inline", result };
  }
  const job = await q.add("sync", { orgId }, { removeOnComplete: true, removeOnFail: 50 });
  return { mode: "queued", jobId: job.id };
}

export async function runSyncDirect(orgIdInput: string | null) {
  const org = orgIdInput
    ? await prisma.organization.findUnique({ where: { id: orgIdInput } })
    : await prisma.organization.findFirst();
  if (!org) return { synced: 0 };

  const [ghIntegration, jiraIntegration] = await Promise.all([
    prisma.integration.findFirst({ where: { orgId: org.id, type: "GITHUB" } }),
    prisma.integration.findFirst({ where: { orgId: org.id, type: "JIRA" } }),
  ]);

  const ghToken = ghIntegration?.accessToken ?? null;
  const ghRepos = (ghIntegration?.meta as { repos?: string[] } | null)?.repos ?? [];
  const [ghOwner, ghRepo] = (ghRepos[0] ?? "").split("/");

  const jiraMeta = jiraIntegration?.meta as { baseUrl?: string; email?: string; projectKey?: string } | null;
  const jiraCreds: JiraCreds | null =
    jiraMeta?.baseUrl && jiraMeta?.email
      ? { baseUrl: jiraMeta.baseUrl, email: jiraMeta.email, token: jiraIntegration!.accessToken }
      : null;
  const projectKey = jiraMeta?.projectKey ?? org.jiraProjectKey ?? "CLAR";

  const [qa, bug, pr] = await Promise.all([
    getQAPassRate(projectKey, 8, jiraCreds),
    getBugReopenRate(projectKey, 56, jiraCreds),
    getPRCycleTime(ghOwner || org.githubOrgName, ghRepo || null, 56, ghToken),
  ]);

  const snapshots: { metricType: "QA_PASS_RATE" | "BUG_REOPEN_RATE" | "PR_CYCLE_TIME"; value: number | null }[] = [
    { metricType: "QA_PASS_RATE", value: qa.current },
    { metricType: "BUG_REOPEN_RATE", value: bug.current },
    { metricType: "PR_CYCLE_TIME", value: pr.current },
  ];

  for (const s of snapshots) {
    if (s.value == null) continue;
    await prisma.metricSnapshot.create({
      data: { orgId: org.id, metricType: s.metricType, value: s.value },
    });
  }
  await prisma.integration.updateMany({ where: { orgId: org.id }, data: { lastSyncedAt: new Date() } });
  return { synced: snapshots.filter((s) => s.value != null).length };
}

export async function getQueueEvents() {
  const conn = getConnection();
  if (!conn) return null;
  return new QueueEvents(SYNC_QUEUE, { connection: conn });
}
