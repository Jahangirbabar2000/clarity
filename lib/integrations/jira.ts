import type { MetricSeries } from "@/types/models";
import { USE_MOCKS } from "@/lib/utils";
import { mockQAPassRate, mockBugReopen, mockVelocity, mockJiraRecent } from "./mock-data";

export type JiraCreds = { baseUrl: string; email: string; token: string };

function envCreds(): JiraCreds | null {
  const baseUrl = process.env.JIRA_BASE_URL;
  const email = process.env.JIRA_USER_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  if (!baseUrl || !email || !token) return null;
  return { baseUrl, email, token };
}

function hasCreds(creds?: JiraCreds | null) {
  return Boolean(creds ?? envCreds());
}

async function jiraFetch(path: string, init?: RequestInit, creds?: JiraCreds | null) {
  const c = creds ?? envCreds();
  if (!c) throw new Error("JIRA not configured");
  const auth = Buffer.from(`${c.email}:${c.token}`).toString("base64");
  const res = await fetch(`${c.baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`JIRA ${res.status}: ${await res.text()}`);
  return res.json();
}

async function agileFetch(path: string, init?: RequestInit, creds?: JiraCreds | null) {
  const c = creds ?? envCreds();
  if (!c) throw new Error("JIRA not configured");
  const auth = Buffer.from(`${c.email}:${c.token}`).toString("base64");
  const res = await fetch(`${c.baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`JIRA Agile ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Metrics ───────────────────────────────────────────────────────────────────

const NO_DATA: MetricSeries = { hasData: false, current: null, previous: null, trend: [] };

export async function getQAPassRate(
  projectKey: string,
  lastNSprints = 8,
  creds?: JiraCreds | null,
): Promise<MetricSeries> {
  if (USE_MOCKS) return mockQAPassRate;
  if (!hasCreds(creds)) return NO_DATA;
  try {
    const sinceDays = lastNSprints * 14;
    const [closedData, reopenedData] = await Promise.all([
      jiraFetch(
        `/rest/api/3/search?jql=${encodeURIComponent(`project = ${projectKey} AND status = Done AND updated >= "-${sinceDays}d"`)}&maxResults=0`,
        undefined, creds,
      ),
      jiraFetch(
        `/rest/api/3/search?jql=${encodeURIComponent(`project = ${projectKey} AND status CHANGED TO "Reopened" AFTER "-${sinceDays}d"`)}&maxResults=0`,
        undefined, creds,
      ),
    ]);
    const closed: number = closedData.total ?? 0;
    const reopened: number = reopenedData.total ?? 0;
    const rate = closed > 0 ? Math.max(0, (closed - reopened) / closed) : null;
    return { hasData: rate !== null, current: rate, previous: null, trend: [] };
  } catch {
    return NO_DATA;
  }
}

export async function getBugReopenRate(
  projectKey: string,
  sinceDays = 56,
  creds?: JiraCreds | null,
): Promise<MetricSeries> {
  if (USE_MOCKS) return mockBugReopen;
  if (!hasCreds(creds)) return NO_DATA;
  try {
    const [totalData, reopenedData] = await Promise.all([
      jiraFetch(
        `/rest/api/3/search?jql=${encodeURIComponent(`project = ${projectKey} AND issuetype = Bug AND created >= "-${sinceDays}d"`)}&maxResults=0`,
        undefined, creds,
      ),
      jiraFetch(
        `/rest/api/3/search?jql=${encodeURIComponent(`project = ${projectKey} AND issuetype = Bug AND status CHANGED TO "Reopened" AFTER "-${sinceDays}d"`)}&maxResults=0`,
        undefined, creds,
      ),
    ]);
    const total: number = totalData.total ?? 0;
    const reopened: number = reopenedData.total ?? 0;
    const rate = total > 0 ? reopened / total : null;
    return { hasData: rate !== null, current: rate, previous: null, trend: [] };
  } catch {
    return NO_DATA;
  }
}

export async function getSprintVelocity(
  projectKey: string,
  lastNSprints = 6,
  creds?: JiraCreds | null,
) {
  const emptyVelocity = { committed: 0, delivered: 0, trend: [] };
  if (USE_MOCKS || !hasCreds(creds)) return emptyVelocity;
  try {
    const boardData = await agileFetch(
      `/rest/agile/1.0/board?projectKeyOrId=${projectKey}&maxResults=1`,
      undefined, creds,
    );
    const boardId = boardData.values?.[0]?.id;
    if (!boardId) return emptyVelocity;

    const sprintData = await agileFetch(
      `/rest/agile/1.0/board/${boardId}/sprint?state=closed&maxResults=${lastNSprints}`,
      undefined, creds,
    );
    const sprints: { id: number; name: string }[] = sprintData.values ?? [];
    if (sprints.length === 0) return emptyVelocity;

    const velocities = await Promise.all(
      sprints.map(async (sp) => {
        try {
          const issues = await agileFetch(
            `/rest/agile/1.0/sprint/${sp.id}/issue?fields=customfield_10016,status&maxResults=100`,
            undefined, creds,
          );
          const allIssues: { fields?: { customfield_10016?: number; status?: { statusCategory?: { key: string } } } }[] = issues.issues ?? [];
          const committed = allIssues.reduce((s, i) => s + (i.fields?.customfield_10016 ?? 0), 0);
          const delivered = allIssues
            .filter((i) => i.fields?.status?.statusCategory?.key === "done")
            .reduce((s, i) => s + (i.fields?.customfield_10016 ?? 0), 0);
          return { label: sp.name, committed, delivered };
        } catch { return null; }
      }),
    );

    const valid = velocities.filter((v): v is { label: string; committed: number; delivered: number } => v !== null);
    if (valid.length === 0) return emptyVelocity;
    const last = valid.at(-1)!;
    return { committed: last.committed, delivered: last.delivered, trend: valid };
  } catch {
    return { committed: 0, delivered: 0, trend: [] };
  }
}

export async function getRecentTicketTitles(
  projectKey: string,
  limit = 20,
  creds?: JiraCreds | null,
): Promise<string[]> {
  if (USE_MOCKS || !hasCreds(creds)) return mockJiraRecent.slice(0, limit);
  try {
    const data = await jiraFetch(
      `/rest/api/3/search?jql=${encodeURIComponent(`project=${projectKey} ORDER BY updated DESC`)}&fields=summary&maxResults=${limit}`,
      undefined, creds,
    );
    return (data.issues ?? []).map((i: { fields?: { summary?: string } }) => i.fields?.summary ?? "").filter(Boolean);
  } catch {
    return mockJiraRecent.slice(0, limit);
  }
}

export async function createJiraIssue(
  input: {
    projectKey: string;
    summary: string;
    description: string;
    issueType: "Story" | "Bug" | "Task" | "Spike" | "Subtask";
    labels?: string[];
    parentKey?: string;
  },
  creds?: JiraCreds | null,
) {
  const c = creds ?? envCreds();
  if (USE_MOCKS || !c) {
    const fakeId = `${input.projectKey}-${Math.floor(100 + Math.random() * 900)}`;
    const base = c?.baseUrl ?? process.env.JIRA_BASE_URL ?? "https://example.atlassian.net";
    return { id: fakeId, key: fakeId, self: `${base}/browse/${fakeId}`, url: `${base}/browse/${fakeId}` };
  }
  const body = {
    fields: {
      project: { key: input.projectKey },
      summary: input.summary,
      description: adfFromText(input.description),
      issuetype: { name: input.issueType },
      labels: input.labels ?? [],
      ...(input.parentKey ? { parent: { key: input.parentKey } } : {}),
    },
  };
  const data = await jiraFetch(`/rest/api/3/issue`, { method: "POST", body: JSON.stringify(body) }, c);
  return { id: data.id, key: data.key, self: data.self, url: `${c.baseUrl}/browse/${data.key}` };
}

// ── Agile / Sprint ────────────────────────────────────────────────────────────

export async function getJiraBoardId(projectKey: string, creds?: JiraCreds | null): Promise<number | null> {
  if (USE_MOCKS || !hasCreds(creds)) return null;
  try {
    const data = await agileFetch(`/rest/agile/1.0/board?projectKeyOrId=${projectKey}&maxResults=1`, undefined, creds);
    return data.values?.[0]?.id ?? null;
  } catch { return null; }
}

export async function getOrCreateJiraSprint(boardId: number, sprintName: string, creds?: JiraCreds | null): Promise<number | null> {
  if (USE_MOCKS || !hasCreds(creds)) return null;
  try {
    const data = await agileFetch(
      `/rest/agile/1.0/board/${boardId}/sprint?state=active,future&maxResults=50`,
      undefined, creds,
    );
    const existing = (data.values ?? []).find((s: { name: string }) => s.name.toLowerCase() === sprintName.toLowerCase());
    if (existing) return existing.id;
    const created = await agileFetch(`/rest/agile/1.0/sprint`, {
      method: "POST",
      body: JSON.stringify({ name: sprintName, originBoardId: boardId }),
    }, creds);
    return created.id ?? null;
  } catch { return null; }
}

export async function assignIssuesToJiraSprint(sprintId: number, issueKeys: string[], creds?: JiraCreds | null): Promise<void> {
  if (USE_MOCKS || !hasCreds(creds) || issueKeys.length === 0) return;
  try {
    await agileFetch(`/rest/agile/1.0/sprint/${sprintId}/issue`, {
      method: "POST",
      body: JSON.stringify({ issues: issueKeys }),
    }, creds);
  } catch { /* best-effort */ }
}

export type JiraSprint = {
  id: number;
  name: string;
  state: "active" | "future" | "closed";
  startDate?: string;
  endDate?: string;
};

export type JiraSprintIssue = {
  key: string;
  title: string;
  storyPoints: number | null;
  issueType: string;
  status: string;
};

export async function getJiraSprints(boardId: number, creds?: JiraCreds | null): Promise<JiraSprint[]> {
  if (USE_MOCKS || !hasCreds(creds)) return [];
  try {
    const data = await agileFetch(
      `/rest/agile/1.0/board/${boardId}/sprint?state=active,future&maxResults=20`,
      undefined, creds,
    );
    return (data.values ?? []).map((s: { id: number; name: string; state: string; startDate?: string; endDate?: string }) => ({
      id: s.id, name: s.name, state: s.state as JiraSprint["state"],
      startDate: s.startDate, endDate: s.endDate,
    }));
  } catch { return []; }
}

export async function getSprintIssues(sprintId: number, creds?: JiraCreds | null): Promise<JiraSprintIssue[]> {
  if (USE_MOCKS || !hasCreds(creds)) return [];
  try {
    const data = await agileFetch(
      `/rest/agile/1.0/sprint/${sprintId}/issue?fields=summary,issuetype,status,customfield_10016&maxResults=100`,
      undefined, creds,
    );
    return (data.issues ?? []).map((i: {
      key: string;
      fields: { summary: string; issuetype?: { name: string }; status?: { name: string }; customfield_10016?: number | null };
    }) => ({
      key: i.key, title: i.fields.summary,
      storyPoints: i.fields.customfield_10016 ?? null,
      issueType: i.fields.issuetype?.name ?? "Task",
      status: i.fields.status?.name ?? "To Do",
    }));
  } catch { return []; }
}

function adfFromText(text: string) {
  return {
    type: "doc",
    version: 1,
    content: text.split(/\n\n+/).map((p) => ({ type: "paragraph", content: [{ type: "text", text: p }] })),
  };
}
