import { jsonError, jsonOk } from "@/lib/api";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import { clientAppFromRequest } from "@/lib/client-app";
import { listPublicQuestionPatches } from "@/lib/question-patches";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return authPreflight();
}

export async function GET(req: Request) {
  try {
    const appId = clientAppFromRequest(req);
    if (appId !== "hamster") {
      return withAuthCors(jsonOk({ version: 0, patches: [] }));
    }
    const data = await listPublicQuestionPatches();
    return withAuthCors(jsonOk(data));
  } catch (err) {
    console.error(err);
    return withAuthCors(jsonError("加载失败", 500));
  }
}
