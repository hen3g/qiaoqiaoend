/**
 * Sync local course zips → Cloudflare R2 + MySQL.
 *
 * Usage:
 *   node --env-file=.env.local scripts/sync-courses.mjs
 *   node --env-file=.env.local scripts/sync-courses.mjs --skip-upload
 *   node --env-file=.env.local scripts/sync-courses.mjs --dry-run
 */

import { createReadStream, existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import mysql from "mysql2/promise";
import {
  CATEGORIES,
  categorySlugForTitle,
  levelLabel,
} from "./course-categories.mjs";

const CONCURRENCY = Number(process.env.R2_UPLOAD_CONCURRENCY || 8);

const require = createRequire(import.meta.url);
// zipfile via python is simpler for reading; use adm-zip if available, else unzip via child_process
let AdmZip;
try {
  AdmZip = require("adm-zip");
} catch {
  AdmZip = null;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DEFAULT_ZIP_DIR = "/Users/xuezhiwen/babyenglishzip/single";

const args = new Set(process.argv.slice(2));
const SKIP_UPLOAD = args.has("--skip-upload");
const DRY_RUN = args.has("--dry-run");
const FORCE_UPLOAD = args.has("--force-upload");

const ZIP_DIR = process.env.COURSE_ZIP_DIR || DEFAULT_ZIP_DIR;

function publicBaseUrl() {
  let base = (process.env.R2_PUBLIC_BASE_URL || "").replace(/\/$/, "");
  if (!base) throw new Error("R2_PUBLIC_BASE_URL is required");
  if (!/^https?:\/\//i.test(base)) base = `https://${base}`;
  return base;
}

function r2Key(slug) {
  return `courses/${slug}.zip`;
}

function downloadUrl(slug) {
  return `${publicBaseUrl()}/${r2Key(slug)}`;
}

function createS3() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("Missing R2_* env vars");
  }
  return {
    bucket,
    client: new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    }),
  };
}

async function objectExists(client, bucket, key) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (err) {
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === "NotFound") {
      return false;
    }
    // Some R2 setups return 403/404 differently
    if (String(err?.name || "").includes("NotFound") || err?.Code === "NotFound") {
      return false;
    }
    throw err;
  }
}

async function uploadZip(client, bucket, slug, filePath) {
  const key = r2Key(slug);
  if (!FORCE_UPLOAD && (await objectExists(client, bucket, key))) {
    return { key, skipped: true };
  }
  const upload = new Upload({
    client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: createReadStream(filePath),
      ContentType: "application/zip",
      ContentDisposition: `attachment; filename="${slug}.zip"`,
    },
  });
  await upload.done();
  return { key, skipped: false };
}

function readCourseJsonFromZip(zipPath, slug) {
  if (!AdmZip) {
    throw new Error("Please install adm-zip: npm i -D adm-zip");
  }
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  let entry =
    entries.find((e) => e.entryName.includes(`external-courses/${slug}.json`)) ||
    entries.find(
      (e) => e.entryName.endsWith(".json") && e.entryName.includes("external-courses"),
    );
  if (!entry) {
    throw new Error(`No course JSON in ${path.basename(zipPath)}`);
  }
  const data = JSON.parse(entry.getData().toString("utf8"));
  const lessons = data.lessons || [];
  let wordCount = 0;
  for (const lesson of lessons) {
    wordCount += (lesson.words || []).length;
  }
  return {
    slug,
    title: data.title || slug,
    description: data.description || null,
    difficulty: data.difficulty ?? null,
    durationMinutes: data.durationMinutes ?? 0,
    wordCount,
    lessonCount: lessons.length,
  };
}

async function ensureSchema(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS course_categories (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      slug VARCHAR(64) NOT NULL,
      title VARCHAR(128) NOT NULL,
      subtitle VARCHAR(255) NULL,
      description TEXT NULL,
      accent_color VARCHAR(32) NULL,
      tint_color VARCHAR(32) NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_course_categories_slug (slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const [cols] = await conn.query(`SHOW COLUMNS FROM courses`);
  const names = new Set(cols.map((c) => c.Field));

  if (!names.has("category_id")) {
    await conn.query(
      `ALTER TABLE courses ADD COLUMN category_id BIGINT UNSIGNED NULL AFTER id`,
    );
  }
  if (!names.has("difficulty")) {
    await conn.query(
      `ALTER TABLE courses ADD COLUMN difficulty TINYINT NULL AFTER level`,
    );
  }
  if (!names.has("r2_key")) {
    await conn.query(
      `ALTER TABLE courses ADD COLUMN r2_key VARCHAR(255) NULL AFTER download_url`,
    );
  }

  // Drop FK if we need to wipe courses; ensure index
  try {
    await conn.query(
      `ALTER TABLE courses ADD INDEX idx_courses_category_id (category_id)`,
    );
  } catch {
    /* already exists */
  }
}

async function seedCategories(conn) {
  const idBySlug = new Map();
  for (const cat of CATEGORIES) {
    await conn.query(
      `INSERT INTO course_categories
        (slug, title, subtitle, description, accent_color, tint_color, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         title = VALUES(title),
         subtitle = VALUES(subtitle),
         description = VALUES(description),
         accent_color = VALUES(accent_color),
         tint_color = VALUES(tint_color),
         sort_order = VALUES(sort_order)`,
      [
        cat.slug,
        cat.title,
        cat.subtitle,
        cat.description,
        cat.accent,
        cat.tint,
        cat.sortOrder,
      ],
    );
    const [rows] = await conn.query(
      `SELECT id FROM course_categories WHERE slug = ? LIMIT 1`,
      [cat.slug],
    );
    idBySlug.set(cat.slug, rows[0].id);
  }
  return idBySlug;
}

async function replaceCourses(conn, courses, categoryIdBySlug) {
  await conn.query(`DELETE FROM user_courses`);
  const slugs = courses.map((c) => c.slug);
  if (slugs.length) {
    await conn.query(`DELETE FROM courses WHERE slug NOT IN (?)`, [slugs]);
  } else {
    await conn.query(`DELETE FROM courses`);
  }

  const values = [];
  const placeholders = [];
  let sort = 0;
  for (const course of courses) {
    sort += 10;
    const catSlug = categorySlugForTitle(course.title);
    const categoryId = categoryIdBySlug.get(catSlug) ?? null;
    const isFree = 1;
    const level = levelLabel(course.difficulty);
    values.push(
      categoryId,
      course.slug,
      course.title,
      course.description,
      level,
      course.difficulty,
      course.wordCount,
      course.durationMinutes,
      downloadUrl(course.slug),
      r2Key(course.slug),
      isFree,
      0,
      sort,
    );
    placeholders.push("(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  }

  if (!values.length) return;

  // Insert in chunks to stay under max_allowed_packet
  const CHUNK = 50;
  for (let start = 0; start < courses.length; start += CHUNK) {
    const end = Math.min(start + CHUNK, courses.length);
    const slicePlaceholders = placeholders.slice(start, end);
    const sliceValues = values.slice(start * 13, end * 13);
    await conn.query(
      `INSERT INTO courses
        (category_id, slug, title, description, level, difficulty, word_count,
         duration_minutes, download_url, r2_key, is_free, requires_vip, sort_order)
       VALUES ${slicePlaceholders.join(",")}
       ON DUPLICATE KEY UPDATE
         category_id = VALUES(category_id),
         title = VALUES(title),
         description = VALUES(description),
         level = VALUES(level),
         difficulty = VALUES(difficulty),
         word_count = VALUES(word_count),
         duration_minutes = VALUES(duration_minutes),
         download_url = VALUES(download_url),
         r2_key = VALUES(r2_key),
         is_free = VALUES(is_free),
         requires_vip = VALUES(requires_vip),
         sort_order = VALUES(sort_order)`,
      sliceValues,
    );
  }
}

async function main() {
  if (!existsSync(ZIP_DIR)) {
    throw new Error(`Zip directory not found: ${ZIP_DIR}`);
  }

  const zipFiles = readdirSync(ZIP_DIR)
    .filter((f) => f.endsWith(".zip"))
    .sort();
  console.log(`Found ${zipFiles.length} zip files in ${ZIP_DIR}`);

  if (!AdmZip) {
    console.log("Installing adm-zip…");
    const { execSync } = await import("node:child_process");
    execSync("npm install -D adm-zip", { cwd: ROOT, stdio: "inherit" });
    AdmZip = createRequire(import.meta.url)("adm-zip");
  }

  // Also need @aws-sdk/lib-storage for multipart
  try {
    require("@aws-sdk/lib-storage");
  } catch {
    const { execSync } = await import("node:child_process");
    execSync("npm install -D @aws-sdk/lib-storage", { cwd: ROOT, stdio: "inherit" });
  }

  const courses = [];
  for (const file of zipFiles) {
    const slug = file.replace(/\.zip$/i, "");
    const zipPath = path.join(ZIP_DIR, file);
    const meta = readCourseJsonFromZip(zipPath, slug);
    meta.zipBytes = statSync(zipPath).size;
    meta.categorySlug = categorySlugForTitle(meta.title);
    courses.push(meta);
  }

  const manifestPath = path.join(ROOT, "scripts", "courses-manifest.json");
  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        count: courses.length,
        publicBaseUrl: publicBaseUrl(),
        courses: courses.map((c) => ({
          ...c,
          downloadUrl: downloadUrl(c.slug),
          r2Key: r2Key(c.slug),
          isFree: true,
        })),
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`Wrote manifest → ${manifestPath}`);

  if (DRY_RUN) {
    console.log("Dry run — skipping upload and DB.");
    const byCat = {};
    for (const c of courses) {
      byCat[c.categorySlug] = (byCat[c.categorySlug] || 0) + 1;
    }
    console.log(byCat);
    return;
  }

  if (!SKIP_UPLOAD) {
    const { client, bucket } = createS3();
    let uploaded = 0;
    let skipped = 0;
    let done = 0;
    let cursor = 0;

    async function worker() {
      while (cursor < zipFiles.length) {
        const i = cursor;
        cursor += 1;
        const file = zipFiles[i];
        const slug = file.replace(/\.zip$/i, "");
        const zipPath = path.join(ZIP_DIR, file);
        try {
          const result = await uploadZip(client, bucket, slug, zipPath);
          done += 1;
          if (result.skipped) {
            skipped += 1;
            console.log(`[${done}/${zipFiles.length}] ${slug} skip`);
          } else {
            uploaded += 1;
            console.log(`[${done}/${zipFiles.length}] ${slug} ok`);
          }
        } catch (err) {
          console.error(`[${i + 1}/${zipFiles.length}] ${slug} FAIL`, err);
          throw err;
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, zipFiles.length) }, () => worker()),
    );
    console.log(`R2 done: uploaded=${uploaded} skipped=${skipped}`);
  } else {
    console.log("Skipping R2 upload (--skip-upload)");
  }

  const conn = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT || 3306),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    multipleStatements: true,
  });

  try {
    await ensureSchema(conn);
    const categoryIdBySlug = await seedCategories(conn);
    await replaceCourses(conn, courses, categoryIdBySlug);
    const [[{ cnt }]] = await conn.query(`SELECT COUNT(*) AS cnt FROM courses`);
    const [[{ ccat }]] = await conn.query(
      `SELECT COUNT(*) AS ccat FROM course_categories`,
    );
    console.log(`DB seeded: categories=${ccat} courses=${cnt}`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
