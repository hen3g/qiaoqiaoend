import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import {
  deleteUserCourseGroup,
  renameUserCourseGroup,
} from "@/lib/user-course-groups-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function OPTIONS() {
  return authPreflight();
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(jsonError("请先登录", 401));
    }
    const groupId = Number(params.id);
    if (!Number.isInteger(groupId) || groupId <= 0) {
      return withAuthCors(jsonError("分组无效"));
    }
    const body = (await req.json().catch(() => null)) as {
      name?: unknown;
    } | null;
    const name = typeof body?.name === "string" ? body.name : "";
    const group = await renameUserCourseGroup(user.id, groupId, name);
    if (!group) {
      return withAuthCors(jsonError("分组不存在", 404));
    }
    return withAuthCors(jsonOk({ group }));
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "重命名失败";
    return withAuthCors(jsonError(message, 422));
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(jsonError("请先登录", 401));
    }
    const groupId = Number(params.id);
    if (!Number.isInteger(groupId) || groupId <= 0) {
      return withAuthCors(jsonError("分组无效"));
    }
    const ok = await deleteUserCourseGroup(user.id, groupId);
    if (!ok) {
      return withAuthCors(jsonError("分组不存在", 404));
    }
    return withAuthCors(jsonOk({ deleted: true }));
  } catch (err) {
    console.error(err);
    return withAuthCors(jsonError("删除分组失败", 500));
  }
}
