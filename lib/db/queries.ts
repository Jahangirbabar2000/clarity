import { prisma } from "./client";

export async function getOrgForUser(userId: string) {
  const member = await prisma.orgMember.findFirst({
    where: { userId },
    include: { org: true },
    orderBy: { id: "asc" },
  });
  return member?.org ?? null;
}

export async function ensureDemoOrg() {
  let org = await prisma.organization.findFirst({ where: { name: "Demo Org" } });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: "Demo Org",
        jiraProjectKey: "CLAR",
      },
    });
  }
  return org;
}

export async function getTicketWithRelations(id: string) {
  return prisma.ticket.findUnique({
    where: { id },
    include: {
      subtasks: { orderBy: { order: "asc" }, include: { sprintAssignment: true } },
      sprintAssignments: { include: { sprint: true } },
    },
  });
}

export async function listTickets(orgId: string) {
  return prisma.ticket.findMany({
    where: { orgId },
    orderBy: { updatedAt: "desc" },
    include: { subtasks: { select: { id: true } }, sprintAssignments: { select: { sprintId: true } } },
  });
}

export async function listSprintsForOrg(orgId: string) {
  return prisma.sprint.findMany({
    where: { orgId },
    orderBy: { order: "asc" },
    include: {
      assignments: { include: { subtask: true, ticket: true } },
    },
  });
}

export async function listInsights(orgId: string, limit = 20) {
  return prisma.aIInsight.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

import type { IntegrationType } from "@prisma/client";

export async function getIntegration(orgId: string, type: IntegrationType) {
  return prisma.integration.findFirst({ where: { orgId, type } });
}
