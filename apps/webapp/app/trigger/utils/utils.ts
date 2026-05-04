import {
  type Conversation,
  type ConversationHistory,
} from "@prisma/client";

import nodeCrypto from "node:crypto";
import { customAlphabet } from "nanoid";
import { prisma } from "~/db.server";

// Token generation utilities
const tokenValueLength = 40;
const tokenGenerator = customAlphabet(
  "123456789abcdefghijkmnopqrstuvwxyz",
  tokenValueLength,
);
const tokenPrefix = "rc_pat_";

type CreatePersonalAccessTokenOptions = {
  name: string;
  userId: string;
};

function createToken() {
  return `${tokenPrefix}${tokenGenerator()}`;
}

function obfuscateToken(token: string) {
  const withoutPrefix = token.replace(tokenPrefix, "");
  const obfuscated = `${withoutPrefix.slice(0, 4)}${"•".repeat(18)}${withoutPrefix.slice(-4)}`;
  return `${tokenPrefix}${obfuscated}`;
}

function encryptToken(value: string) {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error("ENCRYPTION_KEY environment variable is required");
  }

  const nonce = nodeCrypto.randomBytes(12);
  const cipher = nodeCrypto.createCipheriv(
    "aes-256-gcm",
    encryptionKey,
    nonce as any,
  );

  let encrypted = cipher.update(value, "utf8", "hex");
  encrypted += cipher.final("hex");

  const tag = cipher.getAuthTag().toString("hex");

  return {
    nonce: nonce.toString("hex"),
    ciphertext: encrypted,
    tag,
  };
}

function hashToken(token: string): string {
  const hash = nodeCrypto.createHash("sha256");
  hash.update(token);
  return hash.digest("hex");
}

export async function getOrCreatePersonalAccessToken({
  name,
  userId,
}: CreatePersonalAccessTokenOptions) {
  const existing = await prisma.personalAccessToken.findFirst({
    where: {
      name,
      userId,
      revokedAt: null,
    },
  });

  if (existing) {
    return {
      id: existing.id,
      name: existing.name,
      userId: existing.userId,
      obfuscatedToken: existing.obfuscatedToken,
    };
  }

  const token = createToken();
  const encryptedToken = encryptToken(token);

  const personalAccessToken = await prisma.personalAccessToken.create({
    data: {
      name,
      userId,
      encryptedToken,
      obfuscatedToken: obfuscateToken(token),
      hashedToken: hashToken(token),
    },
  });

  return {
    id: personalAccessToken.id,
    name,
    userId,
    token,
    obfuscatedToken: personalAccessToken.obfuscatedToken,
  };
}

export interface InitChatPayload {
  conversationId: string;
  conversationHistoryId: string;
  context: any;
  pat: string;
}

export interface RunChatPayload {
  conversationId: string;
  conversationHistoryId: string;
  context: any;
  conversation: Conversation;
  conversationHistory: ConversationHistory;
  pat: string;
  isContinuation?: boolean;
}

export const getActivityDetails = async (activityId: string) => {
  if (!activityId) {
    return {};
  }

  const activity = await prisma.activity.findFirst({
    where: {
      id: activityId,
    },
  });

  return {
    activityId,
    integrationAccountId: activity?.integrationAccountId,
    sourceURL: activity?.sourceURL,
  };
};

export const generateRandomId = (): string => {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters.charAt(randomIndex);
  }
  return result.toLowerCase();
};

export function flattenObject(obj: Record<string, any>, prefix = ""): string[] {
  return Object.entries(obj).reduce<string[]>((result, [key, value]) => {
    const entryKey = prefix ? `${prefix}_${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      return [...result, ...flattenObject(value, entryKey)];
    }
    return [...result, `- ${entryKey}: ${value}`];
  }, []);
}

export const getActivity = async (activityId: string) => {
  return await prisma.activity.findUnique({
    where: {
      id: activityId,
    },
    include: {
      workspace: true,
    },
  });
};

export const updateActivity = async (
  activityId: string,
  rejectionReason: string,
) => {
  return await prisma.activity.update({
    where: {
      id: activityId,
    },
    data: {
      rejectionReason,
    },
  });
};

export async function deletePersonalAccessToken(tokenId: string) {
  return await prisma.personalAccessToken.delete({
    where: {
      id: tokenId,
    },
  });
}

export async function hasCredits(
  workspaceId: string,
  userId: string,
  operation: string,
): Promise<boolean> {
  return true;
}

export async function deductCredits(
  workspaceId: string,
  userId: string,
  reason: string,
  credits: number,
): Promise<{ success: boolean }> {
  return { success: true };
}
