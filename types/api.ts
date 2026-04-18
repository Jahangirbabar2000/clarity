import type { MetricSeries, TicketWithRelations, AIInsight, Sprint, Subtask } from "./models";

// ----- Metrics -----

export type MetricResponse = MetricSeries;

export type LibraryHealthResponse = {
  hasData: boolean;
  upToDate: number;
  minorUpdates: number;
  criticalCVEs: number;
  sample: { name: string; current: string; latest: string; severity: "ok" | "minor" | "critical" }[];
};

// ----- Insights -----

export type GenerateInsightsRequest = { orgId: string };
export type GenerateInsightsResponse = { insights: AIInsight[] };

// ----- Workspace -----

export type BuildTicketRequest = { idea: string; orgId?: string };

export type GeneratedTicket = {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  edgeCases: string[];
  outOfScope: string[];
  type: "FEATURE" | "BUG" | "IMPROVEMENT" | "SPIKE";
  priority: "HIGH" | "MED" | "LOW";
  storyPoints: number;
  suggestedLabels: string[];
};

export type GeneratedSubtask = {
  title: string;
  description: string;
  type: "FRONTEND" | "BACKEND" | "DATABASE" | "TESTING" | "INFRA" | "DEVOPS" | "PM";
  storyPoints: number;
  priority: "HIGH" | "MED" | "LOW";
  dependsOn: string[];
  suggestedSprint: number;
};

export type BuildTicketPayload = { ticket: GeneratedTicket; subtasks: GeneratedSubtask[] };

export type BuildTicketResponse = {
  ticketId: string;
  ticket: GeneratedTicket;
  subtasks: (GeneratedSubtask & { id: string })[];
};

export type RefineTicketRequest = {
  ticketId: string;
  field: "title" | "description" | "acceptanceCriteria" | "edgeCases" | "outOfScope" | "subtasks";
  editRequest: string;
};

export type RefineTicketResponse = { field: string; value: unknown };

export type BuildSprintPlanRequest = {
  ticketId: string;
  velocityPerSprint: number;
  sprintLengthWeeks: number;
};

export type BuildSprintPlanResponse = {
  sprints: (Sprint & { subtasks: Subtask[] })[];
};

export type PushToJiraRequest = { ticketId: string };
export type PushToJiraResponse = {
  parentJiraUrl: string;
  subtaskUrls: { subtaskId: string; url: string }[];
};

export type TicketListItem = TicketWithRelations;

// ----- Integrations -----

export type IntegrationStatus = {
  type: "GITHUB" | "JIRA" | "SENTRY" | "DATADOG" | "NOTION" | "CI" | "PRD_UPLOAD";
  connected: boolean;
  lastSyncedAt: string | null;
  meta?: Record<string, unknown>;
};
