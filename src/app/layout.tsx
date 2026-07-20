import type { Metadata } from "next";
import { Noto_Sans_SC, Outfit } from "next/font/google";
import Script from "next/script";
import { AuthProvider } from "@/components/AuthProvider";
import { VConsole } from "@/components/VConsole";
import "./globals.css";

const GA_ID = "G-GY20QVPJG6";

const display = Outfit({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const body = Noto_Sans_SC({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

/** Prevent nginx/CDN from caching HTML shells for a year across deploys. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "宝贝英语官网",
    template: "%s · 宝贝英语",
  },
  description:
    "宝贝英语：用键盘敲句子学英语。看中文提示，敲出对应英文，从单词练到完整句子。下载客户端、注册账号、课程下载与会员兑换。",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const enableAnalytics = process.env.NODE_ENV === "production";
  const enableVConsole = process.env.NODE_ENV === "development";

  return (
    <html lang="zh-CN" className={`${display.variable} ${body.variable} h-full`}>
      <body className="min-h-full antialiased">
        <AuthProvider>
          {children}
          {enableVConsole ? <VConsole /> : null}
        </AuthProvider>
      </body>
      {enableAnalytics ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}');
            `}
          </Script>
        </>
      ) : null}
    </html>
  );
}
