import { getUserSession } from "./session.server";

export type ApiAuthenticationResultSuccess = {
  ok: true;
  type: "PRIVATE" | "PUBLIC";
  userId: string;
  workspaceId?: string;
  scopes?: string[];
};

export type ApiAuthenticationResult =
  | ApiAuthenticationResultSuccess
  | { ok: false; error: string };

export async function authenticateApiRequestWithFailure(
  request: Request,
  options: { allowJWT?: boolean } = {},
): Promise<ApiAuthenticationResult | null> {
  const authHeader = request.headers.get("authorization");
  const apiKey = authHeader?.replace("Bearer ", "");

  if (!apiKey) {
    const session = await getUserSession(request);
    if (session) {
      return {
        ok: true,
        type: "PRIVATE",
        userId: session.userId,
        workspaceId: session.workspaceId,
        scopes: ["read", "write"],
      };
    }
    return null;
  }

  return {
    ok: true,
    type: "PRIVATE",
    userId: "api-user",
    workspaceId: undefined,
    scopes: ["read", "write"],
  };
}
