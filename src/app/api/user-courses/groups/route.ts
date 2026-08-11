import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import {
  createUserCourseGroup,
  listUserCourseGroups,
} from "@/lib/user-course-groups-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return authPreflight();
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(jsonError("请先登录", 401));
    }
    const groups = await listUserCourseGroups(user.id);
    return withAuthCors(jsonOk({ groups }));
  } catch (err) {
    console.error(err);
    return withAuthCors(jsonError("加载分组失败", 500));
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(jsonError("请先登录", 401));
    }
    const body = (await req.json().catch(() => null)) as {
      name?: unknown;
    } | null;
    const name = typeof body?.name === "string" ? body.name : "";
    const group = await createUserCourseGroup(user.id, name);
    return withAuthCors(jsonOk({ group }));
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "创建分组失败";
    return withAuthCors(jsonError(message, 422));
  }
}
