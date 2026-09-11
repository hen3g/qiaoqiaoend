import { NextResponse } from "next/server";
import { resolveErrorCode } from "@/lib/error-codes";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, ...data }, init);
}

/**
 * Error JSON: `{ ok: false, error, code?, ...extra }`.
 * Pass `{ code }` explicitly when possible; otherwise a known Chinese
 * `message` is mapped via `resolveErrorCode`.
 */
export function jsonError(
  message: string,
  status = 400,
  extra?: Record<string, unknown>,
) {
  const explicit =
    extra && typeof extra.code === "string" ? extra.code : undefined;
  const code = resolveErrorCode(message, explicit);
  const body: Record<string, unknown> = {
    ok: false,
    error: message,
    ...extra,
  };
  if (code) body.code = code;
  else delete body.code;
  return NextResponse.json(body, { status });
}
