import { jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { listCoursesGroupedForUser } from "@/lib/courses";

export async function GET() {
  const user = await getCurrentUser();
  const { categories, total } = await listCoursesGroupedForUser(user);
  return jsonOk({ categories, total, user });
}
