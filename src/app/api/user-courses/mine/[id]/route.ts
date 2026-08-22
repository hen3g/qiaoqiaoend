import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import { updateMyCourseMeta } from "@/lib/user-courses-store";

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

    const body = (await req.json().catch(() => null)) as {
      title?: unknown;
      note?: unknown;
      groupId?: unknown;
    } | null;

    if (!body || (body.note === undefined && body.groupId === undefined && body.title === undefined)) {
      return withAuthCors(jsonError("请提供备注或分组"));
    }

    const patch: {
      title?: string;
      note?: string | null;
      groupId?: number | null;
    } = {};

    if (body.title !== undefined) {
      if (typeof body.title !== "string") {
        return withAuthCors(jsonError("课程名称格式无效"));
      }
      patch.title = body.title;
    }

    if (body.note !== undefined) {
      if (body.note === null) {
        patch.note = null;
      } else if (typeof body.note === "string") {
        patch.note = body.note;
      } else {
        return withAuthCors(jsonError("备注格式无效"));
      }
    }

    if (body.groupId !== undefined) {
      if (body.groupId === null || body.groupId === 0 || body.groupId === "") {
        patch.groupId = null;
      } else {
        const n = Number(body.groupId);
        if (!Number.isInteger(n) || n <= 0) {
          return withAuthCors(jsonError("分组无效"));
        }
        patch.groupId = n;
      }
    }

    const course = await updateMyCourseMeta(user.id, params.id, patch);
    if (!course) {
      return withAuthCors(jsonError("课程不存在", 404));
    }
    return withAuthCors(jsonOk({ course }));
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "更新失败";
    const status = message === "分组不存在" ? 404 : 422;
    return withAuthCors(jsonError(message, status));
  }
}
