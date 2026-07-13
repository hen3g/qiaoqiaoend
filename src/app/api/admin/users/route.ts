import type { RowDataPacket } from "mysql2";
import { jsonError, jsonOk } from "@/lib/api";
import { mapUser, type SessionUser } from "@/lib/auth";
import { requireDevAdmin } from "@/lib/dev-admin";
import { query } from "@/lib/db";

type UserRow = RowDataPacket & {
  id: number;
  username: string;
  nickname: string | null;
  vip_expires_at: Date | string | null;
  created_at: Date | string | null;
  token_version: number;
};

export type AdminUserDto = SessionUser & {
  tokenVersion: number;
};

function adminError(err: unknown) {
  if (err instanceof Error) {
    if (err.message === "NOT_FOUND") return jsonError("不可用", 404);
    if (err.message === "UNAUTHORIZED") return jsonError("请先登录", 401);
    if (err.message === "FORBIDDEN") return jsonError("无权限", 403);
  }
  return null;
}

async function listUsers(): Promise<AdminUserDto[]> {
  const rows = await query<UserRow[]>(
    `SELECT id, username, nickname, vip_expires_at, created_at, token_version
     FROM users
     ORDER BY id ASC`,
  );
  return rows.map((row) => ({
    ...mapUser(row),
    tokenVersion: row.token_version ?? 0,
  }));
}

export async function GET() {
  try {
    await requireDevAdmin();
    const users = await listUsers();
    return jsonOk({ users, total: users.length });
  } catch (err) {
    const mapped = adminError(err);
    if (mapped) return mapped;
    console.error(err);
    return jsonError("加载失败", 500);
  }
}
