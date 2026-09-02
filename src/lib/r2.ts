import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export function r2PublicBaseUrl(): string {
  let base = requireEnv("R2_PUBLIC_BASE_URL").replace(/\/$/, "");
  if (!/^https?:\/\//i.test(base)) {
    base = `https://${base}`;
  }
  return base;
}

let client: S3Client | null = null;

function getR2Client(): S3Client {
  if (client) return client;
  const accountId = requireEnv("R2_ACCOUNT_ID");
  const accessKeyId = requireEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv("R2_SECRET_ACCESS_KEY");
  client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return client;
}

function getR2Bucket(): string {
  return requireEnv("R2_BUCKET_NAME");
}

export function userCourseObjectKey(
  userId: number | string,
  courseId: string,
): string {
  return `user-courses/${userId}/${courseId}.json`;
}

export function userCoursesPrefix(userId: number | string): string {
  return `user-courses/${userId}/`;
}

export function app2DictionaryObjectKey(slug: string): string {
  return `dictionary/app2/${slug}.json`;
}

export function app2DictionaryPrefix(): string {
  return "dictionary/app2/";
}

export function audioObjectKey(filename: string): string {
  return `audio/${filename}`;
}

export function r2PublicUrl(key: string): string {
  return `${r2PublicBaseUrl()}/${key.replace(/^\//, "")}`;
}

export async function uploadPublicObject(input: {
  key: string;
  body: Buffer;
  contentType: string;
  cacheControl?: string;
}): Promise<{ key: string; url: string }> {
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: getR2Bucket(),
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      CacheControl: input.cacheControl ?? "public, max-age=31536000, immutable",
    }),
  );
  return {
    key: input.key,
    url: `${r2PublicBaseUrl()}/${input.key}`,
  };
}

export async function r2Head(key: string): Promise<boolean> {
  try {
    await getR2Client().send(
      new HeadObjectCommand({ Bucket: getR2Bucket(), Key: key }),
    );
    return true;
  } catch (err) {
    const status = (err as { $metadata?: { httpStatusCode?: number } })
      .$metadata?.httpStatusCode;
    if (status === 404) return false;
    const name = (err as { name?: string }).name;
    if (name === "NotFound" || name === "NoSuchKey") return false;
    throw err;
  }
}

export async function r2GetBuffer(key: string): Promise<Buffer | null> {
  try {
    const res = await getR2Client().send(
      new GetObjectCommand({ Bucket: getR2Bucket(), Key: key }),
    );
    if (!res.Body) return null;
    const bytes = await res.Body.transformToByteArray();
    return Buffer.from(bytes);
  } catch (err) {
    const status = (err as { $metadata?: { httpStatusCode?: number } })
      .$metadata?.httpStatusCode;
    if (status === 404) return null;
    const name = (err as { name?: string }).name;
    if (name === "NoSuchKey" || name === "NotFound") return null;
    throw err;
  }
}

export async function r2GetText(key: string): Promise<string | null> {
  const buf = await r2GetBuffer(key);
  return buf ? buf.toString("utf8") : null;
}

export async function r2Put(
  key: string,
  body: Buffer | string | Uint8Array,
  contentType: string,
): Promise<void> {
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: getR2Bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function r2Delete(key: string): Promise<void> {
  await getR2Client().send(
    new DeleteObjectCommand({
      Bucket: getR2Bucket(),
      Key: key,
    }),
  );
}

export async function r2ListKeys(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const res = await getR2Client().send(
      new ListObjectsV2Command({
        Bucket: getR2Bucket(),
        Prefix: prefix,
        ContinuationToken: token,
      }),
    );
    for (const obj of res.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key);
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}
