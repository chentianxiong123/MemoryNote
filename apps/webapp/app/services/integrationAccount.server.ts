import { prisma } from "~/db.server";
import type { Prisma } from "@prisma/client";

export async function getIntegrationAccount(integrationAccountId: string) {
  return prisma.integrationAccount.findUnique({
    where: { id: integrationAccountId },
    include: { integrationDefinition: true },
  });
}

export async function getIntegrationAccounts(
  integratedById: string,
  workspaceId?: string,
) {
  return prisma.integrationAccount.findMany({
    where: {
      integratedById,
      deleted: null,
      ...(workspaceId ? { workspaceId } : {}),
    },
    include: { integrationDefinition: true },
  });
}

export async function getWorkspaceIntegrationAccounts(workspaceId: string) {
  return prisma.integrationAccount.findMany({
    where: { workspaceId, deleted: null },
    include: { integrationDefinition: true },
  });
}

export async function createIntegrationAccount(data: {
  integratedById: string;
  workspaceId: string;
  integrationDefinitionId: string;
  integrationConfiguration?: Record<string, unknown>;
  accountId?: string;
  settings?: Record<string, unknown>;
}) {
  return prisma.integrationAccount.create({
    data: {
      integratedById: data.integratedById,
      workspaceId: data.workspaceId,
      integrationDefinitionId: data.integrationDefinitionId,
      integrationConfiguration: data.integrationConfiguration as Prisma.InputJsonValue || {},
      accountId: data.accountId,
      settings: data.settings as Prisma.InputJsonValue | undefined,
    },
    include: { integrationDefinition: true },
  });
}

export async function updateIntegrationAccount(
  id: string,
  data: {
    integrationConfiguration?: Record<string, unknown>;
    settings?: Record<string, unknown>;
    isActive?: boolean;
  },
) {
  const updateData: Prisma.IntegrationAccountUpdateInput = {};
  if (data.integrationConfiguration !== undefined) {
    updateData.integrationConfiguration = data.integrationConfiguration as Prisma.InputJsonValue;
  }
  if (data.settings !== undefined) {
    updateData.settings = data.settings as Prisma.InputJsonValue;
  }
  if (data.isActive !== undefined) {
    updateData.isActive = data.isActive;
  }
  return prisma.integrationAccount.update({
    where: { id },
    data: updateData,
  });
}

export async function deleteIntegrationAccount(id: string) {
  return prisma.integrationAccount.update({
    where: { id },
    data: { deleted: new Date() },
  });
}
