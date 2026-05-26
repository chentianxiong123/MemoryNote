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
  return {
    ok: true,
    type: "PRIVATE",
    userId: "test-user-001",
    workspaceId: "test-ws-001",
    scopes: ["read", "write"],
  };
}
