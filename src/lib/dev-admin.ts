import { getCurrentUser, type SessionUser } from "@/lib/auth";
import {
  DEV_ADMIN_USERNAME,
  isAdminUsername,
} from "@/lib/admin-username";

export { DEV_ADMIN_USERNAME, isAdminUsername };

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
