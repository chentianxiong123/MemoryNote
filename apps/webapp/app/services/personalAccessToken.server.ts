import { prisma } from "~/db.server";
import { nanoid } from "nanoid";
import crypto from "crypto";
import type { Prisma } from "@prisma/client";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function encryptToken(token: string): { encrypted: Prisma.InputJsonValue; obfuscated: string } {
  const obfuscated = token.slice(0, 8) + "********";
  return { encrypted: { token } as Prisma.InputJsonValue, obfuscated };
}

export async function createPersonalAccessToken(
  userId: string,
  name: string,
  workspaceId?: string,
) {
  const rawToken = `core_${nanoid(32)}`;
  const { encrypted, obfuscated } = encryptToken(rawToken);
  const hashedToken = hashToken(rawToken);

  const result = await prisma.personalAccessToken.create({
    data: {
      name,
      encryptedToken: encrypted,
      obfuscatedToken: obfuscated,
      hashedToken,
      userId,
      workspaceId,
    },
  });

  return { ...result, rawToken };
}

export async function getPersonalAccessToken(hashedToken: string) {
  return prisma.personalAccessToken.findUnique({
    where: { hashedToken },
    include: { user: true },
  });
}

export async function deletePersonalAccessToken(id: string) {
  return prisma.personalAccessToken.delete({
    where: { id },
  });
}

export async function listPersonalAccessTokens(userId: string) {
  return prisma.personalAccessToken.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function authenticateApiRequestWithPersonalAccessToken(
  request: Request,
) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token || !token.startsWith("core_")) {
    return null;
  }

  const hashedToken = hashToken(token);
  const pat = await getPersonalAccessToken(hashedToken);
  if (!pat) {
    return null;
  }

  return {
    userId: pat.userId,
    user: pat.user,
    token: pat,
    workspaceId: pat.workspaceId ?? undefined,
  };
}
