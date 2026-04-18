import type { MetricSeries } from "@/types/models";
import { USE_MOCKS } from "@/lib/utils";
import { mockQAPassRate, mockBugReopen, mockVelocity, mockJiraRecent } from "./mock-data";

type JiraCreds = { baseUrl: string; email: string; token: string };

function creds(): JiraCreds | null {
  const baseUrl = process.env.JIRA_BASE_URL;
  const email = process.env.JIRA_USER_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  if (!baseUrl || !email || !token) return null;
  return { baseUrl, email, token };
}

async function jiraFetch(path: string, init?: RequestInit) {
  const c = creds();
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

export async function getQAPassRate(_projectKey: string, _lastNSprints = 8): Promise<MetricSeries> {
  if (USE_MOCKS || !creds()) return mockQAPassRate;
  return mockQAPassRate;
}

export async function getBugReopenRate(_projectKey: string, _sinceDays = 56): Promise<MetricSeries> {
  if (USE_MOCKS || !creds()) return mockBugReopen;
  return mockBugReopen;
}

export async function getSprintVelocity(_projectKey: string, _lastNSprints = 6) {
  if (USE_MOCKS || !creds()) return mockVelocity;
  return mockVelocity;
}

export async function getRecentTicketTitles(_projectKey: string, limit = 20): Promise<string[]> {
  if (USE_MOCKS || !creds()) return mockJiraRecent.slice(0, limit);
  try {
    const data = await jiraFetch(
      `/rest/api/3/search?jql=project=${_projectKey}+ORDER+BY+updated+DESC&fields=summary&maxResults=${limit}`,
    );
    return (data.issues ?? []).map((i: { fields?: { summary?: string } }) => i.fields?.summary ?? "").filter(Boolean);
  } catch {
    return mockJiraRecent.slice(0, limit);
  }
}

export async function createJiraIssue(input: {
  projectKey: string;
  summary: string;
  description: string;
  issueType: "Story" | "Bug" | "Task" | "Spike";
  labels?: string[];
  parentKey?: string;
}) {
  if (USE_MOCKS || !creds()) {
    const fakeId = `${input.projectKey}-${Math.floor(100 + Math.random() * 900)}`;
    const base = process.env.JIRA_BASE_URL ?? "https://example.atlassian.net";
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
  const data = await jiraFetch(`/rest/api/3/issue`, { method: "POST", body: JSON.stringify(body) });
  const base = process.env.JIRA_BASE_URL ?? "";
  return { id: data.id, key: data.key, self: data.self, url: `${base}/browse/${data.key}` };
}

function adfFromText(text: string) {
  return {
    type: "doc",
    version: 1,
    content: text
      .split(/\n\n+/)
      .map((p) => ({ type: "paragraph", content: [{ type: "text", text: p }] })),
  };
}
