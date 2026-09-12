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
    metaTitle: "仓鼠单词会员服务协议",
    metaDescription:
      "仓鼠单词会员服务协议：说明 VIP 会员权益、付费规则、自动续费与退款等事项。",
    updatedAt: "2026年9月2日",
    updatedLabel: "最近更新日期",
    eyebrow: "Legal",
    title: "会员服务协议",
    lead:
      "本协议是你与言词科技（大连）有限公司（下称「我们」）之间，就「仓鼠单词」VIP 会员服务订立的协议。请在开通或续费前仔细阅读。点击同意、勾选或完成支付，即表示你已阅读并同意本协议。若你不同意，请不要购买或续费。",
    s1Title: "1. 服务说明",
    s1Body1:
      "VIP 会员是我们向付费用户提供的增值学习服务。开通后，你可以在会员有效期内使用当时产品界面展示的会员权益（包括但不限于自制词库、更高练习额度、会员钻石礼包等）。权益内容可能随产品迭代调整，以购买时及 App 内公示为准。",
    s1Before: "个人信息处理规则见",
    s1Privacy: "《隐私政策》",
    s1Mid: "；一般使用规则见",
    s1Terms: "《用户协议》",
    s1After: "。",
    s2Title: "2. 会员套餐与价格",
    s2Items: [
      "套餐名称、价格、时长、赠送钻石等，以购买页面实时展示为准。",
      "Android 端目前主要通过支付宝完成一次性购买；会员时长自支付成功时起算，可重复购买并叠加有效期。",
      "iOS 端可能提供 App 内购买及自动续费订阅（如连续包月）。订阅价格、优惠期、续费周期以 App Store 商品页及支付界面展示为准，并受 Apple 相关规则约束。",
      "钻石等虚拟物品仅可在本应用内使用，不兑现、不转让。钻石主要用于为词库中没有的单词生成练习题目，每个单词的消耗可能不同。",
    ],
    s3Title: "3. 自动续费（仅适用于开通自动续费的套餐）",
    s3Items: [
      "若你选择连续包月等自动续费套餐，首个计费周期结束后，将按公示价格自动续费，直至你取消。",
      "iOS 用户可在系统「设置 → Apple 账户 → 订阅」中管理或取消。取消后，当前已付费周期结束前仍可使用会员权益，到期后不再扣款。",
      "未在扣款前取消的，视为你同意下一周期续费。因未及时取消产生的续费，按渠道规则处理。",
    ],
    s4Title: "4. 支付与到账",
    s4Items: [
      "支付成功后，会员权益与赠送钻石通常立即到账。",
      "若已扣款但权益未到账，请稍后在「我的」中查看，或通过本协议载明的联系方式联系我们，并尽量提供订单时间、金额与支付凭证。",
      "我们不会向你索取银行卡完整卡号或支付密码。",
    ],
    s5Title: "5. 退款与售后",
    s5Items: [
      "会员、钻石等虚拟商品一经售出，除法律法规另有规定或我们书面承诺外，通常不支持退换。",
      "iOS 内购与订阅的退款，由 Apple 审核处理，你可通过 Apple 账户申请；我们无法直接撤销 App Store 扣款。",
      "Android 支付宝支付如因系统故障导致重复扣款、未开通成功等，我们将在核实后协助处理（补发权益或按原路退回等）。",
    ],
    s6Title: "6. 使用规范与中止",
    s6Body:
      "你不得利用会员权益从事违法违规、侵权、滥用接口、出借或转售账号等行为。情节严重的，我们有权限制、中止或终止相关服务，已支付费用依法不予退还的除外。",
    s7Title: "7. 协议变更",
    s7Body:
      "我们可能适时修订本协议，并在本页面公布。若变更对你的权益有重大影响，我们将尽量通过应用内提示等方式告知。你继续购买或续费即视为接受修订后的协议。",
    s8Title: "8. 联系我们",
    vipPageLabel: "会员服务协议页面",
  },
  ja: {
    metaTitle: "倉鼠単語会員サービス規約",
    metaDescription:
      "倉鼠単語の会員サービス規約：VIP 会員特典、課金ルール、自動更新、返金等について説明します。",
    updatedAt: "2026年9月2日",
    updatedLabel: "最終更新日",
    eyebrow: "Legal",
    title: "会員サービス規約",
    lead:
      "本規約は、Yanci Technology (Dalian) Co., Ltd.（以下「当社」）とお客様との間で、「倉鼠単語」VIP 会員サービスについて定めるものです。ご契約または更新の前に必ずお読みください。同意へのタップ・チェック、または支払い完了により、本規約を読み同意したものとみなされます。同意できない場合は、購入または更新を行わないでください。",
    s1Title: "1. サービス内容",
    s1Body1:
      "VIP 会員は、有料ユーザー向けの付加価値学習サービスです。契約後、会員有効期間中は、その時点の製品画面に表示される会員特典を利用できます（自作単語帳、より高い練習上限、会員ダイヤ特典等を含みますが、これらに限りません）。特典内容は製品の更新に伴い変更される場合があり、購入時および App 内の公示に従います。",
    s1Before: "個人情報の取扱いについては",
    s1Privacy: "プライバシーポリシー",
    s1Mid: "を、一般的な利用ルールについては",
    s1Terms: "利用規約",
    s1After: "をご確認ください。",
    s2Title: "2. 会員プランと価格",
    s2Items: [
      "プラン名、価格、期間、付与ダイヤ等は、購入ページのリアルタイム表示に従います。",
      "Android ではアプリ内課金による一括購入を利用します。会員期間は支払い成功時から起算し、繰り返し購入して有効期間を加算できます。",
      "iOS ではアプリ内課金および自動更新サブスクリプション（例：連続月額）を提供する場合があります。価格、キャンペーン期間、更新周期は App Store の商品ページおよび支払い画面の表示に従い、Apple の関連規則が適用されます。",
      "ダイヤ等の仮想アイテムは本アプリ内でのみ使用でき、換金・譲渡はできません。ダイヤは主に、単語帳にない単語の練習問題生成に使用し、単語ごとの消費量は異なる場合があります。",
    ],
    s3Title: "3. 自動更新（自動更新プランを契約した場合のみ）",
    s3Items: [
      "連続月額など自動更新プランを選択した場合、最初の課金周期の終了後、公示価格で自動更新され、解約するまで続きます。",
      "iOS ユーザーは、システム「設定 → Apple アカウント → サブスクリプション」で管理または解約できます。解約後も、既に支払済みの周期が終わるまでは会員特典を利用でき、期限後は課金されません。",
      "課金前に解約しなかった場合、次の周期の更新に同意したものとみなします。解約遅延による更新は、各チャネルの規則に従い処理します。",
    ],
    s4Title: "4. 支払いと反映",
    s4Items: [
      "支払い成功後、会員特典および付与ダイヤは通常すぐに反映されます。",
      "課金済みでも特典が反映されない場合は、しばらくして「マイページ」をご確認いただくか、本規約記載の連絡先までご連絡ください。注文時刻、金額、支払い証明をご用意いただけると助かります。",
      "当社が銀行カードの完全な番号や支払いパスワードを尋ねることはありません。",
    ],
    s5Title: "5. 返金とアフターサービス",
    s5Items: [
      "会員・ダイヤ等の仮想商品は、法令に別段の定めがある場合または当社が書面で約束した場合を除き、販売後の返品・交換に通常対応しません。",
      "iOS のアプリ内課金・サブスクリプションの返金は Apple が審査・処理します。Apple アカウントから申請できます。当社が App Store の課金を直接取り消すことはできません。",
      "Android 決済で、システム障害による二重課金や契約未完了等があった場合、確認のうえ対応します（特典の再付与、または元の経路での返金等）。",
    ],
    s6Title: "6. 利用規範と停止",
    s6Body:
      "会員特典を利用して、違法・規約違反、権利侵害、API の乱用、アカウントの貸与または転売等を行ってはなりません。重大な場合、当社は関連サービスの制限・停止・終了を行うことができ、法令により返金しない場合を除き、既払料金は返金しません。",
    s7Title: "7. 規約の変更",
    s7Body:
      "当社は必要に応じて本規約を改定し、本ページに掲載します。お客様の権利に重大な影響がある変更については、可能な限りアプリ内通知等でお知らせします。改定後に購入または更新を続ける場合、改定後の規約に同意したものとみなします。",
    s8Title: "8. お問い合わせ",
    vipPageLabel: "会員サービス規約ページ",
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

export default function HamsterVipAgreementPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const lang = resolveHamsterLang(searchParams);
  const c = COPY[lang];

  return (
    <CompanyShell hideChrome>
      <article className={styles.legal} lang={lang === "ja" ? "ja" : "zh-CN"}>
        <p className={styles.legal__eyebrow}>{c.eyebrow}</p>
        <h1>{c.title}</h1>
        <p className={styles.legal__updated}>
          {c.updatedLabel}：{c.updatedAt}
        </p>
        <p className={styles.legal__lead}>{c.lead}</p>

        <section>
          <h2>{c.s1Title}</h2>
          <p>{c.s1Body1}</p>
          <p>
            {c.s1Before}
            <Link href={hamsterHref("/hamster/privacy", lang)}>
              {c.s1Privacy}
            </Link>
            {c.s1Mid}
            <Link href={hamsterHref("/hamster/terms", lang)}>
              {c.s1Terms}
            </Link>
            {c.s1After}
          </p>
        </section>

        <section>
          <h2>{c.s2Title}</h2>
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
            {c.s4Items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section>
          <h2>{c.s5Title}</h2>
          <ul>
            {c.s5Items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section>
          <h2>{c.s6Title}</h2>
          <p>{c.s6Body}</p>
        </section>

        <section>
          <h2>{c.s7Title}</h2>
          <p>{c.s7Body}</p>
        </section>

        <section>
          <h2>{c.s8Title}</h2>
          <ContactBlock
            lang={lang}
            showWebsite={false}
            extra={
              <>
                <br />
                <a href={hamsterHref("/hamster/vip-agreement", lang)}>
                  {c.vipPageLabel}
                </a>
              </>
            }
          />
        </section>
      </article>
    </CompanyShell>
  );
}
