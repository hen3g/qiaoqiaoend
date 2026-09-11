import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import { ErrorCode } from "@/lib/error-codes";
import {
  ensureUserLocaleColumn,
  getUserLocale,
  setUserLocale,
} from "@/lib/user-schema";

export const dynamic = "force-dynamic";

const schema = z.object({
  locale: z.enum(["zh", "ja"]),
});

export async function OPTIONS() {
  return authPreflight();
}

/** Persist 仓鼠单词 UI locale for multilingual notification targeting. */
export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(
        jsonError("请先登录", 401, { code: ErrorCode.LOGIN_REQUIRED }),
      );
    }

    const body = schema.parse(await req.json());
    await ensureUserLocaleColumn();
    await setUserLocale(user.id, body.locale);
    const locale = await getUserLocale(user.id);

    return withAuthCors(jsonOk({ locale, message: "已更新语言" }));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return withAuthCors(jsonError(err.issues[0]?.message || "参数错误"));
    }
    console.error(err);
    return withAuthCors(
      jsonError("保存失败，请稍后重试", 500, { code: ErrorCode.SAVE_FAILED }),
    );
  }
}
