import { getCurrentUser, type SessionUser } from "@/lib/auth";

export const DEV_ADMIN_USERNAME = "channg";

export function isLocalDevToolsEnabled(): boolean {
  return process.env.NODE_ENV === "development";
}

export function isAdminUsername(username: string): boolean {
  return username.toLowerCase() === DEV_ADMIN_USERNAME;
}

/** Production-safe admin gate: only username `channg`. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  if (!isAdminUsername(user.username)) {
    throw new Error("FORBIDDEN");
  }
  return user;
}

/** Local-dev tools (redeem codes / notifications): development + channg. */
export async function requireDevAdmin(): Promise<SessionUser> {
  if (!isLocalDevToolsEnabled()) {
    throw new Error("NOT_FOUND");
  }
  return requireAdmin();
}
