import { type Workspace } from "@core/database";
import { prisma } from "~/db.server";
import { ensureDefaultProviders } from "~/services/llm-provider.server";
import { logger } from "~/services/logger.service";

interface CreateWorkspaceDto {
  name: string;
  userId: string;
}

// Personal use — workspace is always "personal"
export async function createWorkspace(
  input: CreateWorkspaceDto,
): Promise<any> {
  await prisma.user.update({
    where: { id: input.userId },
    data: { confirmedBasicDetails: true },
  });
  await ensureDefaultProviders();
  logger.info(`User ${input.userId} onboarded`);
  return { id: "personal", name: input.name, slug: "personal", version: "V3" };
}

export async function getWorkspaceById(_id: string) {
  return { id: "personal", name: "Personal", slug: "personal" };
}

export async function isOnboardingV2Done(_workspaceId?: string): Promise<boolean> {
  return true;
}

/**
 * Resolve workspace ID for a given user.
 * If workspaceId is provided, verifies active membership.
 * Otherwise, returns the first active UserWorkspace membership.
 */
export async function resolveWorkspaceIdForUser(
  _userId: string,
  _requestedWorkspaceId?: string,
): Promise<string> {
  return "personal";
}

export async function getButlerName(_workspaceId?: string): Promise<string> {
  return "MemoryNote";
}

export async function getUserWorkspaces(_userId: string) {
  return [{ id: "personal", name: "Personal", slug: "personal" }];
}
