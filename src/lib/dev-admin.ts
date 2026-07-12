import { getCurrentUser, type SessionUser } from "@/lib/auth";

export const DEV_ADMIN_USERNAME = "channg";

export function isLocalDevToolsEnabled(): boolean {
  return process.env.NODE_ENV === "development";
}

export async function requireDevAdmin(): Promise<SessionUser> {
  if (!isLocalDevToolsEnabled()) {
    throw new Error("NOT_FOUND");
  }
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  if (user.username.toLowerCase() !== DEV_ADMIN_USERNAME) {
    throw new Error("FORBIDDEN");
  }
  return user;
}
