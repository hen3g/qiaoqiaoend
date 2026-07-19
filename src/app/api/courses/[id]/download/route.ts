import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getCourseAccess, userCanAccessCourse } from "@/lib/courses";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = params;
    const courseId = Number(id);
    if (!Number.isFinite(courseId)) {
      return jsonError("课程不存在", 404);
    }

    const user = await getCurrentUser();
    const course = await getCourseAccess(user, courseId);
    if (!course) {
      return jsonError("课程不存在", 404);
    }
    if (!userCanAccessCourse(user, course)) {
      return jsonError("无权下载该课程", 403);
    }

    return jsonOk({
      url: course.download_url,
      filename: `${course.slug}.zip`,
      slug: course.slug,
      title: course.title,
    });
  } catch (err) {
    console.error(err);
    return jsonError("下载失败", 500);
  }
}
