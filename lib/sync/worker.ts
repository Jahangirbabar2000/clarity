import { Worker } from "bullmq";
import IORedis from "ioredis";
import { runSyncDirect, SYNC_QUEUE } from "./data-sync";

const url = process.env.REDIS_URL;
if (!url) {
  console.error("REDIS_URL not set — worker will not start.");
  process.exit(1);
}

const connection = new IORedis(url, { maxRetriesPerRequest: null });

const worker = new Worker(
  SYNC_QUEUE,
  async (job) => {
    const orgId = (job.data as { orgId?: string | null })?.orgId ?? null;
    const result = await runSyncDirect(orgId);
    return result;
  },
  { connection },
);

worker.on("completed", (job) => console.log(`[sync] ${job.id} done`));
worker.on("failed", (job, err) => console.error(`[sync] ${job?.id} failed`, err));

console.log("[sync] worker started");
