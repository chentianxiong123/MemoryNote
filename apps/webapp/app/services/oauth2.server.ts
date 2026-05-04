import { prisma } from "~/db.server";

interface AccessTokenResult {
  id: string;
  token: string;
  scope: string;
  expiresAt: Date | null;
  user: {
    id: string;
    email: string;
    name: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    admin: boolean;
    createdAt: Date;
    updatedAt: Date;
    confirmedBasicDetails: boolean;
    onboardingComplete: boolean;
  };
  client: {
    id: string;
    clientId: string;
    name: string;
  };
  workspaceId: string | null;
}

export const oauth2Service = {
  async getOAuth2Token(userId: string, provider: string) {
    return null;
  },

  async saveOAuth2Token(
    userId: string,
    provider: string,
    tokenData: Record<string, unknown>,
  ) {
    return null;
  },

  async deleteOAuth2Token(userId: string, provider: string) {
    return null;
  },

  async validateAccessToken(token: string): Promise<AccessTokenResult | null> {
    return null;
  },
};
