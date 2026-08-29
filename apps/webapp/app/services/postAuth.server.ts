/**
 * Post-authentication stub - no-op.
 */

export async function postAuthentication(
  _params: {
    user: unknown;
    isNewUser: boolean;
    loginMethod: string;
  },
): Promise<void> {
  // No-op
}
