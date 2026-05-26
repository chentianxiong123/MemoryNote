import { type ApiAuthenticationResultSuccess } from "./apiAuth.server";

export type AuthorizationAction =
  | "read"
  | "write"
  | "delete"
  | "admin"
  | "ingest"
  | "conversation"
  | "search"
  | "update";

export type AuthorizationResources = {
  type: string;
  id?: string;
  [key: string]: unknown;
};

export type AuthorizationResult =
  | { authorized: true }
  | { authorized: false; reason: string };

export function checkAuthorization(
  authentication: ApiAuthenticationResultSuccess,
): AuthorizationResult {
  return { authorized: true };
}
