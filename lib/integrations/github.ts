import { Octokit } from "@octokit/rest";
import type { MetricSeries } from "@/types/models";
import { USE_MOCKS } from "@/lib/utils";
import { mockPRCycleTime, mockLibraryHealth, mockRecentCommits } from "./mock-data";

function client() {
  const token = process.env.GITHUB_ACCESS_TOKEN;
  if (!token) return null;
  return new Octokit({ auth: token });
}

export async function getPRCycleTime(
  orgName: string | null,
  repo: string | null,
  sinceDays = 56,
): Promise<MetricSeries> {
  const gh = client();
  if (!gh || !orgName || !repo || USE_MOCKS) return mockPRCycleTime;
  try {
    const since = new Date(Date.now() - sinceDays * 86400_000).toISOString();
    const prs = await gh.paginate(gh.pulls.list, {
      owner: orgName,
      repo,
      state: "closed",
      sort: "updated",
      direction: "desc",
      per_page: 100,
    });
    const merged = prs.filter((p) => p.merged_at && p.merged_at > since);
    const buckets = new Map<string, number[]>();
    for (const pr of merged) {
      if (!pr.created_at || !pr.merged_at) continue;
      const hours = (new Date(pr.merged_at).getTime() - new Date(pr.created_at).getTime()) / 3_600_000;
      const weekKey = weekLabel(new Date(pr.merged_at));
      if (!buckets.has(weekKey)) buckets.set(weekKey, []);
      buckets.get(weekKey)!.push(hours / 24);
    }
    const trend = [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, vals]) => ({ label, value: median(vals) }));
    const current = trend.at(-1)?.value ?? null;
    const previous = trend.at(-2)?.value ?? null;
    return { hasData: trend.length > 0, current, previous, trend };
  } catch {
    return mockPRCycleTime;
  }
}

export async function getOpenStalePRs(orgName: string, repo: string) {
  const gh = client();
  if (!gh || USE_MOCKS) {
    return [
      { number: 412, title: "WIP: checkout refactor", author: "alice", lastActivityDays: 6 },
      { number: 418, title: "Add FX rate cache", author: "bob", lastActivityDays: 4 },
    ];
  }
  try {
    const { data } = await gh.pulls.list({ owner: orgName, repo, state: "open", per_page: 100 });
    const threshold = Date.now() - 3 * 86400_000;
    return data
      .filter((p) => new Date(p.updated_at).getTime() < threshold)
      .map((p) => ({
        number: p.number,
        title: p.title,
        author: p.user?.login ?? "unknown",
        lastActivityDays: Math.round((Date.now() - new Date(p.updated_at).getTime()) / 86400_000),
      }));
  } catch {
    return [];
  }
}

export async function getLibraryHealth(_orgName: string | null, _repo: string | null) {
  return mockLibraryHealth;
}

export async function getRepoFileSummaries(_orgName: string | null, _repo: string | null, maxFiles = 10) {
  return mockRecentCommits.slice(0, maxFiles);
}

function median(nums: number[]) {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function weekLabel(d: Date) {
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400_000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}
