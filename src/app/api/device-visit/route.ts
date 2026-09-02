import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import { clientAppFromRequest } from "@/lib/client-app";
import {
  recordAnonymousVisit,
  recordLoggedInVisit,
  resolveVisitUserId,
  type VisitPlatform,
} from "@/lib/device-visits";
import { ipRateLimited } from "@/lib/ip-rate-limit";
import { touchUserLastApp } from "@/lib/user-schema";

const bodySchema = z.object({
  kind: z.enum(["anonymous", "logged_in"]),
  platform: z.enum(["ios", "android"]),
  deviceId: z.string().trim().min(8).max(64).optional(),
});

export async function OPTIONS() {
  return authPreflight();
}

export async function POST(req: Request) {
  try {
    const limited = await ipRateLimited(req, "device-visit", { max: 120 });
    if (limited) return withAuthCors(limited);

    const json = await req.json().catch(() => null);
    const body = bodySchema.parse(json);
    const appId = clientAppFromRequest(req);

    if (body.kind === "anonymous") {
      if (!body.deviceId) {
        return withAuthCors(jsonError("缺少 deviceId"));
      }
      await recordAnonymousVisit(body.deviceId, appId);
      return withAuthCors(jsonOk({ recorded: true as const, kind: "anonymous" }));
    }

    const userId = await resolveVisitUserId(req);
    if (userId == null) {
      return withAuthCors(jsonError("请先登录", 401));
    }

    await recordLoggedInVisit(userId, body.platform as VisitPlatform, appId);
    await touchUserLastApp(userId, appId);
    return withAuthCors(
      jsonOk({ recorded: true as const, kind: "logged_in" }),
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return withAuthCors(
        jsonError(err.issues[0]?.message || "参数错误"),
      );
    }
    console.error("device-visit:", err);
    return withAuthCors(jsonError("记录失败", 500));
  }
}
