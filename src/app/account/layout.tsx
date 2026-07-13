import type { Metadata } from "next";

/** Avoid year-long CDN/nginx HTML cache so deploys show up on refresh. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "我的账号",
};

export default function AccountLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
