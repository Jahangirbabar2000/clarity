import { Octokit } from "@octokit/rest";
import type { MetricSeries } from "@/types/models";
import { USE_MOCKS } from "@/lib/utils";
import { mockPRCycleTime, mockLibraryHealth, mockRecentCommits } from "./mock-data";

function client(token?: string | null) {
  const t = token ?? process.env.GITHUB_ACCESS_TOKEN;
  if (!t) return null;
  return new Octokit({ auth: t });
}

export async function getPRCycleTime(
  orgName: string | null,
  repo: string | null,
  sinceDays = 56,
  token?: string | null,
): Promise<MetricSeries> {
  const gh = client(token);
  if (USE_MOCKS) return mockPRCycleTime;
  if (!gh || !orgName || !repo) return { hasData: false, current: null, previous: null, trend: [] };
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
    return { hasData: false, current: null, previous: null, trend: [] };
  }
}

export async function getOpenStalePRs(orgName: string, repo: string, token?: string | null) {
  const gh = client(token);
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
  if (USE_MOCKS) return mockLibraryHealth;
  return { hasData: false, upToDate: 0, minorUpdates: 0, criticalCVEs: 0, sample: [] };
}

const CODE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".rb", ".swift", ".kt", ".cs", ".cpp", ".c", ".h"];
const EXCLUDE_PATTERNS = ["node_modules/", "dist/", ".next/", "__pycache__/", ".git/", "vendor/", "coverage/", "build/", ".turbo/"];
const MAX_FILE_BYTES = 4000;

export async function getRepoFileSummaries(
  orgName: string | null,
  repo: string | null,
  idea: string = "",
  token: string | null = null,
  maxFiles = 10,
): Promise<{ path: string; summary: string }[]> {
  const gh = token ? new Octokit({ auth: token }) : client();
  if (!gh || !orgName || USE_MOCKS) return mockRecentCommits.slice(0, maxFiles);

  try {
    let repoName = repo;
    if (!repoName) {
      // Try org repos first, fall back to user repos
      let repos: { name: string }[] = [];
      try {
        const { data } = await gh.repos.listForOrg({ org: orgName, sort: "updated", per_page: 5 });
        repos = data;
      } catch {
        const { data } = await gh.repos.listForAuthenticatedUser({ sort: "updated", per_page: 5 });
        repos = data;
      }
      repoName = repos[0]?.name ?? null;
      if (!repoName) return mockRecentCommits.slice(0, maxFiles);
    }

    const { data: repoData } = await gh.repos.get({ owner: orgName, repo: repoName });
    const { data: treeData } = await gh.git.getTree({
      owner: orgName,
      repo: repoName,
      tree_sha: repoData.default_branch,
      recursive: "1",
    });

    const codeFiles = (treeData.tree ?? [])
      .filter((f) => f.type === "blob" && f.path)
      .filter((f) => CODE_EXTENSIONS.some((ext) => f.path!.endsWith(ext)))
      .filter((f) => !EXCLUDE_PATTERNS.some((p) => f.path!.includes(p)));

    // Score files by keyword overlap with the idea
    const ideaWords = idea.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    const scored = codeFiles.map((f) => {
      const pathLower = f.path!.toLowerCase();
      const score = ideaWords.reduce((s, word) => s + (pathLower.includes(word) ? 2 : 0), 0)
        // Boost API routes, services, and controllers as they're usually most relevant
        + (pathLower.includes("api/") || pathLower.includes("service") || pathLower.includes("controller") ? 1 : 0);
      return { path: f.path!, score };
    });
    scored.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));

    const topFiles = scored.slice(0, maxFiles);
    const results = await Promise.all(
      topFiles.map(async ({ path }) => {
        try {
          const { data } = await gh.repos.getContent({ owner: orgName!, repo: repoName!, path });
          if ("content" in data && data.encoding === "base64") {
            const content = Buffer.from(data.content, "base64").toString("utf-8").slice(0, MAX_FILE_BYTES);
            return { path, summary: content };
          }
        } catch { /* skip unreadable files */ }
        return null;
      }),
    );

    const valid = results.filter((r): r is { path: string; summary: string } => r !== null && r.summary.trim().length > 0);
    return valid.length > 0 ? valid : mockRecentCommits.slice(0, maxFiles);
  } catch {
    return mockRecentCommits.slice(0, maxFiles);
  }
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
