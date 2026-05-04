import { type Workspace } from "@core/database";
import { prisma } from "~/db.server";
import { ensureDefaultProviders } from "~/services/llm-provider.server";
import { logger } from "~/services/logger.service";

interface CreateWorkspaceDto {
  name: string;
  userId: string;
}

export async function createWorkspace(
  input: CreateWorkspaceDto,
): Promise<Workspace> {
  // Generate slug: remove spaces, lowercase, add 5 random letters
  const generateRandomSuffix = () => {
    const chars = "abcdefghijklmnopqrstuvwxyz";
    return Array.from(
      { length: 5 },
      () => chars[Math.floor(Math.random() * chars.length)],
    ).join("");
  };

  const slug =
    input.name.replace(/\s+/g, "-").toLowerCase() + generateRandomSuffix();

  const workspace = await prisma.workspace.create({
    data: {
      slug,
      name: input.name,
      version: "V3",
      UserWorkspace: {
        create: {
          userId: input.userId,
        },
      },
    },
  });

  await prisma.user.update({
    where: { id: input.userId },
    data: {
      confirmedBasicDetails: true,
    },
  });

  await ensureDefaultProviders();

  logger.info(`Created workspace ${workspace.id} for user ${input.userId}`);

  return workspace;
}

export async function getWorkspaceById(id: string) {
  return await prisma.workspace.findFirst({
    where: {
      id,
    },
  });
}

export async function isOnboardingV2Done(
  workspaceId: string,
): Promise<boolean> {
  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId },
    select: { metadata: true },
  });
  const meta = (workspace?.metadata ?? {}) as Record<string, unknown>;
  return meta.onboardingV2Complete === true;
}

/**
 * Resolve workspace ID for a given user.
 * If workspaceId is provided, verifies active membership.
 * Otherwise, returns the first active UserWorkspace membership.
 */
export async function resolveWorkspaceIdForUser(
  userId: string,
  requestedWorkspaceId?: string,
): Promise<string> {
  if (requestedWorkspaceId) {
    const membership = await prisma.userWorkspace.findFirst({
      where: {
        workspaceId: requestedWorkspaceId,
        userId,
        isActive: true,
      },
    });

    if (!membership) {
      throw new Error("Workspace not found");
    }

    return requestedWorkspaceId;
  }

  const membershipWorkspace = await prisma.userWorkspace.findFirst({
    where: {
      userId,
      isActive: true,
    },
    orderBy: { createdAt: "asc" },
    select: { workspaceId: true },
  });

  if (!membershipWorkspace) {
    throw new Error("Workspace not found");
  }

  return membershipWorkspace.workspaceId;
}

export async function getButlerName(workspaceId: string): Promise<string> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true },
  });
  return workspace?.name ?? "Core";
}

export async function getUserWorkspaces(userId: string) {
  const userWorkspaces = await prisma.userWorkspace.findMany({
    where: {
      userId,
      isActive: true,
    },
    orderBy: {
      createdAt: "asc",
    },
    include: {
      workspace: true,
    },
  });

  return userWorkspaces.map((uw) => uw.workspace);
}
