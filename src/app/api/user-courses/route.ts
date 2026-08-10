import type { CoursePack } from "@/data/course-types";
import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import {
  listUserCourseSummariesForUser,
  saveUserCourseForUser,
} from "@/lib/user-courses-store";

export async function OPTIONS() {
  return authPreflight();
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(jsonError("请先登录", 401));
    }
    const courses = await listUserCourseSummariesForUser(user.id);
    return withAuthCors(jsonOk({ courses }));
  } catch (err) {
    console.error(err);
    return withAuthCors(
      jsonError(err instanceof Error ? err.message : "读取课程失败", 500),
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(jsonError("请先登录", 401));
    }

    let body: { course?: CoursePack };
    try {
      body = (await req.json()) as { course?: CoursePack };
    } catch {
      return withAuthCors(jsonError("请求体必须是 JSON"));
    }

    if (!body.course) {
      return withAuthCors(jsonError("缺少 course 字段"));
    }

    const course = await saveUserCourseForUser(user.id, body.course);
    return withAuthCors(jsonOk({ course }));
  } catch (err) {
    console.error(err);
    return withAuthCors(
      jsonError(err instanceof Error ? err.message : "保存课程失败", 422),
    );
  }
}
