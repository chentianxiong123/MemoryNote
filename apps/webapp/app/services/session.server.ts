/**
 * Session service - Personal system simplified.
 *
 * No multi-user/multi-workspace logic. Returns a fixed personal user
 * without any database lookups.
 */

import { redirect } from "~/lib/remix-compat";
import { type Request as ERequest } from "express";

// Fixed personal user (no DB lookup needed)
const PERSONAL_USER = {
  id: "personal",
  email: "me@local",
  name: "我",
  displayName: "我",
  avatarUrl: null as string | null,
  admin: true,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
  metadata: {} as Record<string, unknown>,
  confirmedBasicDetails: true,
  onboardingComplete: true,
  isImpersonating: false,

};

export async function getUserId(
  _request: Request | ERequest,
): Promise<string | undefined> {
  return PERSONAL_USER.id;
}

export async function getUserSession(
  _request: Request | ERequest,
): Promise<{ userId: string } | undefined> {
  return { userId: PERSONAL_USER.id };
}

export async function getUser(_request: Request) {
  return PERSONAL_USER;
}

export async function requireUserId(
  _request: Request,
  _redirectTo?: string,
): Promise<string> {
  return PERSONAL_USER.id;
}

export async function requireUser(_request: Request) {
  return PERSONAL_USER;
}

export async function requireWorkpace(_request: Request) {
  return { id: "personal", name: "Personal", slug: "personal" };
}

export async function logout(_request: Request) {
  return redirect("/");
}

export async function getWorkspaceId(
  _request: Request | ERequest,
  _userId: string,
  providedWorkspaceId?: string | null,
): Promise<string | undefined> {
  return providedWorkspaceId ?? "personal";
}
