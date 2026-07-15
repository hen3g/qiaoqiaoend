"use client";

import { useEffect, useState } from "react";
import { ONLINE_CLIENT_URL } from "@/lib/online";

type Release = {
  id: number;
  platform: string;
  version: string;
  downloadUrl: string;
  fileSize: string | null;
  releaseNotes: string | null;
};

const platformLabel: Record<string, string> = {
  "mac-arm64": "macOS · Apple Silicon",
  "mac-x64": "macOS · Intel",
  windows: "Windows",
};

export function HomeDownload() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/downloads")
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) {
          setError(data.error || "加载失败");
          return;
        }
        setReleases(data.releases || []);
      })
      .catch(() => setError("网络错误"));
  }, []);

  return (
    <section id="download" className="border-y border-line bg-bg-deep text-white">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
        <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
          下载客户端
        </h2>
        <p className="mt-3 max-w-xl text-white/65">
          安装宝贝英语，在电脑上用键盘敲句子学英语。也可先
          <a
            href={ONLINE_CLIENT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mx-1 font-medium text-white underline underline-offset-4 transition hover:text-white/85"
          >
            在线体验
          </a>
          （需注册账号），浏览器即可开练。
        </p>

        {error ? (
          <p className="mt-8 text-sm text-[#ffb4a0]">{error}</p>
        ) : (
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {releases.map((item) => (
              <article
                key={item.id}
                className="border border-white/15 bg-white/5 p-6 transition hover:bg-white/10"
              >
                <p className="text-sm text-white/55">
                  {platformLabel[item.platform] || item.platform}
                </p>
                <h3 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-medium">
                  v{item.version}
                </h3>
                {item.fileSize ? (
                  <p className="mt-2 text-sm text-white/55">大小 {item.fileSize}</p>
                ) : null}
                {item.releaseNotes ? (
                  <p className="mt-3 leading-relaxed text-white/65">
                    {item.releaseNotes}
                  </p>
                ) : null}
                <a
                  href={item.downloadUrl}
                  className="mt-6 inline-flex rounded-xl bg-white px-6 py-3 text-sm font-medium text-bg-deep transition hover:bg-white/90"
                >
                  下载安装包
                </a>
              </article>
            ))}
          </div>
        )}

        {!error && releases.length === 0 ? (
          <p className="mt-8 text-white/65">暂无发布版本，请稍后再来。</p>
        ) : null}
      </div>
    </section>
  );
}
