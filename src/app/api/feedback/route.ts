import { z } from "zod";

import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import { sendBarkPush } from "@/lib/bark";
import {
  createFeedbackSubmission,
  feedbackTypeLabel,
  type FeedbackType,
} from "@/lib/feedback";

const schema = z.object({
  type: z.enum(["problem", "promo"], {
    error: "请选择反馈类型",
  }),
  wechat: z
    .string()
    .trim()
    .min(1, "请填写微信号")
    .max(64, "微信号过长"),
  content: z
    .string()
    .trim()
    .min(1, "请填写内容")
    .max(2000, "内容过长"),
});

export async function OPTIONS() {
  return authPreflight();
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(jsonError("请先登录", 401));
    }

    const body = schema.parse(await req.json());
    const type = body.type as FeedbackType;
    const submission = await createFeedbackSubmission({
      userId: user.id,
      type,
      wechat: body.wechat,
      content: body.content,
    });

    const typeLabel = feedbackTypeLabel(type);
    const who =
      user.nickname?.trim() ||
      user.username ||
      `用户#${user.id}`;
    void sendBarkPush({
      title: `敲敲 · ${typeLabel}`,
      body: `${who}\n微信：${submission.wechat}\n${submission.content}`,
      group: "反馈合作",
    });

    return withAuthCors(
      jsonOk({
        submission,
        message: "已提交，我们会尽快联系你",
      }),
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return withAuthCors(jsonError(err.issues[0]?.message || "参数错误"));
    }
    if (err instanceof Error) {
      return withAuthCors(jsonError(err.message));
    }
    console.error(err);
    return withAuthCors(jsonError("提交失败", 500));
  }
}
