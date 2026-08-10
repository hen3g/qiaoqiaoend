import { jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";

export async function OPTIONS() {
  return authPreflight();
}

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  return withAuthCors(jsonOk({ user }));
}
