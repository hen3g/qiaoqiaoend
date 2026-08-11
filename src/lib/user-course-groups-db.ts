import type { UserCourseGroup } from "@/data/course-types";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { execute, query } from "@/lib/db";
import { ensureMyCourseMetaColumns } from "@/lib/user-course-summaries-db";

type GroupRow = RowDataPacket & {
  id: number;
  name: string;
  sort_order: number;
  course_count?: number;
};

export async function ensureUserCourseGroupsTable(): Promise<void> {
  await ensureMyCourseMetaColumns();
}

function rowToGroup(row: GroupRow): UserCourseGroup {
  return {
    id: Number(row.id),
    name: String(row.name || "").trim() || "未命名",
    sortOrder: Number(row.sort_order) || 0,
    ...(row.course_count != null
      ? { courseCount: Number(row.course_count) || 0 }
      : {}),
  };
}

export async function listUserCourseGroups(
  userId: number,
): Promise<UserCourseGroup[]> {
  await ensureUserCourseGroupsTable();
  const rows = await query<GroupRow[]>(
    `SELECT g.id, g.name, g.sort_order,
            (SELECT COUNT(*) FROM user_course_summaries s
             WHERE s.user_id = g.user_id AND s.group_id = g.id) AS course_count
     FROM user_course_groups g
     WHERE g.user_id = :userId
     ORDER BY g.sort_order ASC, g.id ASC`,
    { userId },
  );
  return rows.map(rowToGroup);
}

export async function getUserCourseGroup(
  userId: number,
  groupId: number,
): Promise<UserCourseGroup | null> {
  await ensureUserCourseGroupsTable();
  const rows = await query<GroupRow[]>(
    `SELECT id, name, sort_order FROM user_course_groups
     WHERE user_id = :userId AND id = :groupId
     LIMIT 1`,
    { userId, groupId },
  );
  return rows[0] ? rowToGroup(rows[0]) : null;
}

export async function createUserCourseGroup(
  userId: number,
  name: string,
): Promise<UserCourseGroup> {
  await ensureUserCourseGroupsTable();
  const trimmed = name.trim().slice(0, 64);
  if (!trimmed) throw new Error("分组名称不能为空");

  const maxRows = await query<(RowDataPacket & { m: number | null })[]>(
    `SELECT MAX(sort_order) AS m FROM user_course_groups WHERE user_id = :userId`,
    { userId },
  );
  const sortOrder = (Number(maxRows[0]?.m) || 0) + 1;

  const result: ResultSetHeader = await execute(
    `INSERT INTO user_course_groups (user_id, name, sort_order, created_at, updated_at)
     VALUES (:userId, :name, :sortOrder, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
    { userId, name: trimmed, sortOrder },
  );

  return {
    id: Number(result.insertId),
    name: trimmed,
    sortOrder,
    courseCount: 0,
  };
}

export async function renameUserCourseGroup(
  userId: number,
  groupId: number,
  name: string,
): Promise<UserCourseGroup | null> {
  await ensureUserCourseGroupsTable();
  const trimmed = name.trim().slice(0, 64);
  if (!trimmed) throw new Error("分组名称不能为空");

  const result = await execute(
    `UPDATE user_course_groups
     SET name = :name, updated_at = UTC_TIMESTAMP()
     WHERE user_id = :userId AND id = :groupId`,
    { userId, groupId, name: trimmed },
  );
  if (result.affectedRows === 0) return null;
  return getUserCourseGroup(userId, groupId);
}

export async function deleteUserCourseGroup(
  userId: number,
  groupId: number,
): Promise<boolean> {
  await ensureUserCourseGroupsTable();
  await execute(
    `UPDATE user_course_summaries
     SET group_id = NULL
     WHERE user_id = :userId AND group_id = :groupId`,
    { userId, groupId },
  );
  const result = await execute(
    `DELETE FROM user_course_groups WHERE user_id = :userId AND id = :groupId`,
    { userId, groupId },
  );
  return result.affectedRows > 0;
}
