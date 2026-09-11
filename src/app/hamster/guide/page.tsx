import type { Metadata } from "next";
import Link from "next/link";
import { CompanyShell } from "@/components/company/CompanyShell";
import styles from "@/components/company/company.module.css";
import { ContactBlock } from "../_lib/ContactBlock";
import {
  hamsterHref,
  resolveHamsterLang,
} from "../_lib/lang";

type SearchParams = Record<string, string | string[] | undefined>;

const COPY = {
  zh: {
    metaTitle: "仓鼠单词用户指南",
    metaDescription:
      "仓鼠单词用户指南：如何选词库、做练习、设学习计划，以及会员与钻石的用法。",
    updatedAt: "2026年9月3日",
    updatedLabel: "最近更新日期",
    eyebrow: "Guide",
    title: "仓鼠单词用户指南",
    leadBefore: "「仓鼠单词」把常用英语单词装进口袋，每天练一点。下面说明首页、练习和会员怎么用。敲敲英语请看",
    leadLink: "《敲敲英语用户指南》",
    leadAfter: "。",
    s1Title: "1. 首页词库",
    s1Items: [
      "首页大卡片、小卡片和列表里的词库可以自定义，入口在「学习设置 → 首页词库」。",
      "点进词库就开始练。进度会记在本机，登录后会员和钻石跟账号走。",
      "也可以把单词做成自制词库，反复练自己那一份。",
    ],
    s2Title: "2. 练习",
    s2Intro:
      "题型包括：看中写英、听音辨词、听音拼写、释义选择、句中选义、听句选译、句中填空、拖拽组句。",
    s2Items: [
      "「学习设置 → 练习设置」可开关音效，以及自定义朗读音色。",
      "句中选义会高亮句子里的目标词，请选择它的中文意思。",
      "做完一组可以看对错和用时；中途退出也可。",
    ],
    s3Title: "3. 学习计划与排行",
    s3Items: [
      "「自定义学习计划」用来安排每天的量，按自己的节奏来。",
      "「学习排行」按答对题数看周榜和月榜。",
      "可开启练习提醒，到点会通知你来练。",
    ],
    s4Title: "4. 会员与钻石",
    s4ItemsBeforeVip: [
      "会员可解除练习次数等限制，开通时可能附赠钻石。",
      "钻石用于生成题目等需要计算的功能。",
      "iOS 走 App Store；安卓可使用支付宝。",
      "VIP 页可查看「会员充值记录」（只记增加的天数，不含兑换码）。",
    ],
    s4VipBefore: "开通前请阅读 ",
    s4VipLink: "《会员服务协议》",
    s4VipAfter: "。",
    s5Title: "5. 账号与设置",
    s5Items: [
      "建议登录后使用，方便同步会员和钻石。",
      "可在「我」里改昵称、密码、头像，或申请删除账号。",
    ],
    s5PrivacyBefore: "隐私说明见 ",
    s5PrivacyLink: "《隐私政策》",
    s5TermsBefore: "；完整规则见 ",
    s5TermsLink: "《用户协议》",
    s5After: "。",
    s6Title: "6. 联系我们",
  },
  ja: {
    metaTitle: "倉鼠単語ユーザーガイド",
    metaDescription:
      "倉鼠単語ユーザーガイド：単語帳の選び方、練習、学習計画、会員とダイヤの使い方。",
    updatedAt: "2026年9月3日",
    updatedLabel: "最終更新日",
    eyebrow: "Guide",
    title: "倉鼠単語ユーザーガイド",
    leadBefore:
      "「倉鼠単語」はよく使う英単語をポケットに入れて、毎日少しずつ練習できます。以下ではホーム、練習、会員の使い方を説明します。敲敲英語については",
    leadLink: "敲敲英語ユーザーガイド",
    leadAfter: "をご覧ください。",
    s1Title: "1. ホームの単語帳",
    s1Items: [
      "ホームの大カード・小カード・一覧の単語帳はカスタマイズできます。入口は「学習設定 → ホーム単語帳」です。",
      "単語帳を開くとすぐ練習を始められます。進捗は端末に保存され、ログイン後は会員とダイヤがアカウントに紐づきます。",
      "単語を自作単語帳にして、自分用のリストを繰り返し練習することもできます。",
    ],
    s2Title: "2. 練習",
    s2Intro:
      "問題タイプには、中国語を見て英語を書く、聞き取りで単語を選ぶ、聞き取りでスペルを書く、意味選択、文中の意味選択、文を聞いて訳を選ぶ、文中の穴埋め、ドラッグで文を組み立てる、などがあります。",
    s2Items: [
      "「学習設定 → 練習設定」で効果音のオン／オフや、読み上げボイスをカスタムできます。",
      "文中の意味選択では、文中の目標単語がハイライトされます。その中国語の意味を選んでください。",
      "一組終了後に正誤と所要時間を確認できます。途中退出も可能です。",
    ],
    s3Title: "3. 学習計画とランキング",
    s3Items: [
      "「カスタム学習計画」で毎日の分量を決め、自分のペースで進められます。",
      "「学習ランキング」では正解数に基づく週次・月次ランキングを確認できます。",
      "練習リマインダーをオンにすると、設定した時刻に通知でお知らせします。",
    ],
    s4Title: "4. 会員とダイヤ",
    s4ItemsBeforeVip: [
      "会員になると練習回数などの制限が解除され、契約時にダイヤが付与される場合があります。",
      "ダイヤは、問題生成など計算を伴う機能に使用します。",
      "iOS は App Store、Android は Alipay（支付宝）を利用できます。",
      "VIP ページでは「会員チャージ履歴」を確認できます（加算日数のみ記録。交換コードは含みません）。",
    ],
    s4VipBefore: "ご契約前に",
    s4VipLink: "会員サービス規約",
    s4VipAfter: "をお読みください。",
    s5Title: "5. アカウントと設定",
    s5Items: [
      "会員とダイヤの同期のため、ログインしてのご利用をおすすめします。",
      "「マイページ」でニックネーム、パスワード、アイコンの変更、またはアカウント削除の申請ができます。",
    ],
    s5PrivacyBefore: "プライバシーについては",
    s5PrivacyLink: "プライバシーポリシー",
    s5TermsBefore: "を、詳細なルールについては",
    s5TermsLink: "利用規約",
    s5After: "をご確認ください。",
    s6Title: "6. お問い合わせ",
  },
} as const;

export function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Metadata {
  const lang = resolveHamsterLang(searchParams);
  const c = COPY[lang];
  return {
    title: c.metaTitle,
    description: c.metaDescription,
  };
}

export default function HamsterGuidePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const lang = resolveHamsterLang(searchParams);
  const c = COPY[lang];

  return (
    <CompanyShell>
      <article className={styles.legal} lang={lang === "ja" ? "ja" : "zh-CN"}>
        <p className={styles.legal__eyebrow}>{c.eyebrow}</p>
        <h1>{c.title}</h1>
        <p className={styles.legal__updated}>
          {c.updatedLabel}：{c.updatedAt}
        </p>
        <p className={styles.legal__lead}>
          {c.leadBefore}
          <Link href="/guide">{c.leadLink}</Link>
          {c.leadAfter}
        </p>

        <section>
          <h2>{c.s1Title}</h2>
          <ul>
            {c.s1Items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section>
          <h2>{c.s2Title}</h2>
          <p>{c.s2Intro}</p>
          <ul>
            {c.s2Items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section>
          <h2>{c.s3Title}</h2>
          <ul>
            {c.s3Items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section>
          <h2>{c.s4Title}</h2>
          <ul>
            {c.s4ItemsBeforeVip.map((item) => (
              <li key={item}>{item}</li>
            ))}
            <li>
              {c.s4VipBefore}
              <Link href={hamsterHref("/hamster/vip-agreement", lang)}>
                {c.s4VipLink}
              </Link>
              {c.s4VipAfter}
            </li>
          </ul>
        </section>

        <section>
          <h2>{c.s5Title}</h2>
          <ul>
            {c.s5Items.map((item) => (
              <li key={item}>{item}</li>
            ))}
            <li>
              {c.s5PrivacyBefore}
              <Link href={hamsterHref("/hamster/privacy", lang)}>
                {c.s5PrivacyLink}
              </Link>
              {c.s5TermsBefore}
              <Link href={hamsterHref("/hamster/terms", lang)}>
                {c.s5TermsLink}
              </Link>
              {c.s5After}
            </li>
          </ul>
        </section>

        <section>
          <h2>{c.s6Title}</h2>
          <ContactBlock lang={lang} />
        </section>
      </article>
    </CompanyShell>
  );
}
