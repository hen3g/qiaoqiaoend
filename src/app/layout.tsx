import type { Metadata } from "next";
import { Noto_Sans_SC, Noto_Serif_SC, Outfit, Syne } from "next/font/google";
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

const companyDisplay = Noto_Serif_SC({
  variable: "--font-company-display",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const companyLatin = Syne({
  variable: "--font-company-latin",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

/** Prevent nginx/CDN from caching HTML shells for a year across deploys. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "言词科技",
    template: "%s · 言词科技",
  },
  description:
    "言词科技专注英语学习软件。让学习者亲手把单词和句子敲出来，把“看得懂”变成“用得上”。",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico" },
    ],
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
    <html
      lang="zh-CN"
      className={`${display.variable} ${body.variable} ${companyDisplay.variable} ${companyLatin.variable} h-full`}
    >
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
