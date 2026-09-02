import { jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import { clientAppFromRequest } from "@/lib/client-app";
import { touchUserLastApp } from "@/lib/user-schema";

export async function OPTIONS() {
  return authPreflight();
}

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (user) {
    await touchUserLastApp(user.id, clientAppFromRequest(req));
  }
  return withAuthCors(jsonOk({ user }));
}
