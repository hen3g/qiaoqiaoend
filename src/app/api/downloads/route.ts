import type { RowDataPacket } from "mysql2";
import { jsonOk } from "@/lib/api";
import { query } from "@/lib/db";

type ReleaseRow = RowDataPacket & {
  id: number;
  platform: string;
  version: string;
  download_url: string;
  file_size: string | null;
  release_notes: string | null;
  is_latest: number;
};

export async function GET() {
  const rows = await query<ReleaseRow[]>(
    `SELECT id, platform, version, download_url, file_size, release_notes, is_latest
     FROM app_releases
     WHERE is_latest = 1
     ORDER BY FIELD(platform, 'mac-arm64', 'mac-x64', 'windows'), id ASC`,
  );

  return jsonOk({
    releases: rows.map((row) => ({
      id: row.id,
      platform: row.platform,
      version: row.version,
      downloadUrl: row.download_url,
      fileSize: row.file_size,
      releaseNotes: row.release_notes,
    })),
  });
}
