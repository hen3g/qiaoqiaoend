/**
 * Bark push: https://bark.day.app
 * Env: BARK_BASE_URL=https://api.day.app/<device_key>
 * (no trailing slash; title/body appended as path segments)
 */
export async function sendBarkPush(input: {
  title: string;
  body: string;
  group?: string;
}): Promise<void> {
  const base = (process.env.BARK_BASE_URL || "").trim().replace(/\/$/, "");
  if (!base) {
    console.warn("[bark] BARK_BASE_URL not set; skip push");
    return;
  }

  const title = encodeURIComponent(input.title.slice(0, 80) || "通知");
  const body = encodeURIComponent(input.body.slice(0, 500) || "");
  const url = new URL(`${base}/${title}/${body}`);
  if (input.group) {
    url.searchParams.set("group", input.group);
  }

  try {
    const res = await fetch(url.toString(), { method: "GET" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("[bark] push failed", res.status, text.slice(0, 200));
    }
  } catch (err) {
    console.warn("[bark] push error", err);
  }
}
