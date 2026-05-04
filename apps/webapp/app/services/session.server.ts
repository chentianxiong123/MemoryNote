import { redirect } from "@remix-run/node";
import { getUserById, findOrCreateMagicLinkUser } from "~/models/user.server";
import { sessionStorage } from "./sessionStorage.server";
import { getImpersonationId } from "./impersonation.server";
import { type Request as ERequest } from "express";
import { prisma } from "~/db.server";
import { getWorkspaceById } from "~/models/workspace.server";
import { postAuthentication } from "./postAuth.server";

const TEST_USER_EMAIL = "test@example.com";
let cachedUserId: string | null = null;
let cachedWorkspaceId: string | null = null;

async function getTestUser() {
  if (cachedUserId) {
    const user = await getUserById(cachedUserId);
    if (user) return user;
  }

  const { user: newUser, isNewUser } = await findOrCreateMagicLinkUser({
    email: TEST_USER_EMAIL,
    authenticationMethod: "MAGIC_LINK",
  });

  await postAuthentication({ user: newUser, isNewUser, loginMethod: "MAGIC_LINK" });
  
  cachedUserId = newUser.id;
  
  const userWorkspace = await prisma.userWorkspace.findFirst({
    where: { userId: newUser.id, isActive: true },
    select: { workspaceId: true },
  });
  cachedWorkspaceId = userWorkspace?.workspaceId || null;

  if (cachedWorkspaceId) {
    const workspace = await prisma.workspace.findFirst({
      where: { id: cachedWorkspaceId },
      select: { metadata: true, name: true, slug: true },
    });
    
    if (workspace) {
      const metadata = (workspace.metadata ?? {}) as Record<string, unknown>;
      
      if (!metadata.onboardingV2Complete) {
        await prisma.workspace.update({
          where: { id: cachedWorkspaceId },
          data: {
            name: workspace.name || "Core",
            slug: workspace.slug || "core",
            metadata: { ...metadata, onboardingV2Complete: true },
          },
        });
        console.log(`✅ Auto-completed onboarding for workspace: ${cachedWorkspaceId}`);
      }
    }
  }

  return newUser;
}

export async function getUserId(
  request: Request | ERequest,
): Promise<string | undefined> {
  const user = await getTestUser();
  return user.id;
}

export async function getUserSession(
  request: Request | ERequest,
): Promise<{ userId: string; workspaceId?: string } | undefined> {
  const user = await getTestUser();
  return { userId: user.id, workspaceId: cachedWorkspaceId ?? undefined };
}

export async function getUser(request: Request) {
  const user = await getTestUser();
  return { ...user, workspaceId: cachedWorkspaceId };
}

export async function requireUserId(request: Request, redirectTo?: string) {
  const user = await getTestUser();
  return user.id;
}

export async function requireUser(request: Request) {
  const user = await getTestUser();
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    admin: user.admin,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    metadata: user.metadata,
    confirmedBasicDetails: user.confirmedBasicDetails,
    onboardingComplete: true,
    isImpersonating: false,
    workspaceId: cachedWorkspaceId,
  };
}

export async function requireWorkpace(request: Request) {
  const user = await getTestUser();
  if (!cachedWorkspaceId) {
    const workspace = await prisma.userWorkspace.findFirst({
      where: { userId: user.id, isActive: true },
    });
    if (workspace) {
      cachedWorkspaceId = workspace.workspaceId;
    }
  }
  
  if (!cachedWorkspaceId) {
    throw new Error("No workspace found");
  }
  
  const workspace = await getWorkspaceById(cachedWorkspaceId);
  return workspace;
}

export async function logout(request: Request) {
  return redirect("/");
}

export async function getWorkspaceId(
  request: Request | ERequest,
  userId: string,
  providedWorkspaceId?: string | null,
): Promise<string | undefined> {
  if (providedWorkspaceId) {
    return providedWorkspaceId;
  }
  return cachedWorkspaceId ?? undefined;
}
