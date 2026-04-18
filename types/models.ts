import type {
  Ticket as PrismaTicket,
  Subtask as PrismaSubtask,
  Sprint as PrismaSprint,
  SprintAssignment as PrismaSprintAssignment,
  MetricSnapshot as PrismaMetricSnapshot,
  AIInsight as PrismaAIInsight,
  Integration as PrismaIntegration,
  Organization as PrismaOrganization,
} from "@prisma/client";

export type Ticket = PrismaTicket;
export type Subtask = PrismaSubtask;
export type Sprint = PrismaSprint;
export type SprintAssignment = PrismaSprintAssignment;
export type MetricSnapshot = PrismaMetricSnapshot;
export type AIInsight = PrismaAIInsight;
export type Integration = PrismaIntegration;
export type Organization = PrismaOrganization;

export type TicketWithRelations = Ticket & {
  subtasks: (Subtask & { sprintAssignment: SprintAssignment | null })[];
  sprintAssignments: (SprintAssignment & { sprint: Sprint })[];
};

export type MetricPoint = { label: string; value: number };

export type MetricSeries = {
  hasData: boolean;
  current: number | null;
  previous: number | null;
  trend: MetricPoint[];
};
