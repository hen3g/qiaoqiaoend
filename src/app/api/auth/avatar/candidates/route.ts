import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import { createAvatarCandidates } from "@/lib/avatar-generate";

export async function OPTIONS() {
  return authPreflight();
}

/** Return a batch of preview avatars (not uploaded until user confirms). */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(jsonError("请先登录", 401));
    }

    const url = new URL(req.url);
    const rawCount = Number(url.searchParams.get("count") || 9);
    const options = createAvatarCandidates(rawCount);

    return withAuthCors(jsonOk({ options }));
  } catch (err) {
    console.error(err);
    return withAuthCors(jsonError("获取头像候选失败，请稍后重试", 500));
  }
}
