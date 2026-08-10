import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import {
  deleteUserCourseForUser,
  loadUserCourseForUser,
} from "@/lib/user-courses-store";

type Ctx = { params: { id: string } };

export async function OPTIONS() {
  return authPreflight();
}

export async function GET(req: Request, { params }: Ctx) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(jsonError("请先登录", 401));
    }
    const course = await loadUserCourseForUser(user.id, params.id);
    if (!course) {
      return withAuthCors(jsonError("课程不存在", 404));
    }
    return withAuthCors(jsonOk({ course }));
  } catch (err) {
    console.error(err);
    return withAuthCors(
      jsonError(err instanceof Error ? err.message : "读取课程失败", 422),
    );
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(jsonError("请先登录", 401));
    }
    const ok = await deleteUserCourseForUser(user.id, params.id);
    if (!ok) {
      return withAuthCors(jsonError("课程不存在", 404));
    }
    return withAuthCors(jsonOk({ deleted: true }));
  } catch (err) {
    console.error(err);
    return withAuthCors(
      jsonError(err instanceof Error ? err.message : "删除课程失败", 422),
    );
  }
}
