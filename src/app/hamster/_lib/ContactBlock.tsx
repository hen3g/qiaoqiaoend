import type { ReactNode } from "react";
import type { HamsterLang } from "./lang";
import {
  COMPANY,
  CONTACT_EMAIL,
  CONTACT_WECHAT,
  PRODUCT,
  SITE_URL,
} from "./lang";

const LABELS = {
  zh: {
    operator: "运营者",
    product: "产品",
    website: "网站",
    /** ZH keeps host as link text (unchanged). */
    websiteLink: "yancilanguage.cn",
    email: "邮箱",
    wechat: "微信",
  },
  ja: {
    operator: "運営者",
    product: "製品",
    website: "ウェブサイト",
    /** JA: no bare domain in link text. */
    websiteLink: "公式サイト",
    email: "メール",
    wechat: "WeChat",
  },
} as const;

export function ContactBlock({
  lang,
  showWebsite = true,
  extra,
}: {
  lang: HamsterLang;
  /** Default true; VIP agreement historically omits website. */
  showWebsite?: boolean;
  /** Extra labeled lines before email (e.g. policy page URL). */
  extra?: ReactNode;
}) {
  const L = LABELS[lang];
  return (
    <p>
      {L.operator}：{COMPANY[lang]}
      <br />
      {L.product}：{PRODUCT[lang]}
      {showWebsite ? (
        <>
          <br />
          {L.website}：
          <a href={SITE_URL}>{L.websiteLink}</a>
        </>
      ) : null}
      {extra}
      <br />
      {L.email}：
      <a href={`mailto:${CONTACT_EMAIL[lang]}`}>{CONTACT_EMAIL[lang]}</a>
      {lang === "zh" ? (
        <>
          <br />
          {L.wechat}：{CONTACT_WECHAT}
        </>
      ) : null}
    </p>
  );
}
