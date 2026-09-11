import type { Metadata } from "next";
import { CompanyShell } from "@/components/company/CompanyShell";
import styles from "@/components/company/company.module.css";
import { ContactBlock } from "../_lib/ContactBlock";
import { resolveHamsterLang } from "../_lib/lang";

type SearchParams = Record<string, string | string[] | undefined>;

const ALIPAY_SDK_POLICY_URL =
  "https://opendocs.alipay.com/open/54/01g6qm#%E6%94%AF%E4%BB%98%E5%AE%9D%20App%20%E6%94%AF%E4%BB%98%E5%AE%A2%E6%88%B7%E7%AB%AF%20SDK%20%E9%9A%90%E7%A7%81%E6%94%BF%E7%AD%96";

const PRIVACY_PAGE_URL =
  "https://qiaoqiaoengapp.word19.com/hamster/privacy";

const COPY = {
  zh: {
    metaTitle: "仓鼠单词隐私政策",
    metaDescription:
      "仓鼠单词隐私政策：说明言词科技如何收集、使用、存储与保护你的个人信息，以及 App 集成的第三方 SDK 信息。",
    updatedAt: "2026年9月2日",
    updatedLabel: "最近更新日期",
    eyebrow: "Legal",
    title: "隐私政策",
    lead:
      "本政策适用于言词科技（大连）有限公司（下称「我们」）运营的英语单词学习软件「仓鼠单词」及相关账号服务。使用本产品即表示你已阅读并理解本政策。若你不同意，请停止使用。",
    s1Title: "1. 我们收集的信息",
    s1Intro: "我们仅收集提供服务所必要的信息，主要包括：",
    s1Items: [
      {
        term: "账号信息：",
        body: "用户名、密码（加密存储）、昵称、可选绑定的邮箱、头像。",
      },
      {
        term: "学习数据：",
        body: "单词练习进度、答题记录、自制词库内容等。",
      },
      {
        term: "会员与交易：",
        body: "会员状态、钻石余额、订单与支付结果。iOS 上可能包含 App Store 交易凭证；Android 上可能包含支付宝交易信息。我们不会存储完整银行卡号。",
      },
      {
        term: "反馈与客服：",
        body: "你主动提交的问题描述、联系方式（如微信号）。",
      },
      {
        term: "设备与日志：",
        body: "为统计访问、排查故障，可能记录设备类型、系统版本、大致访问时间等，不用于识别你的现实身份。",
      },
      {
        term: "本地数据：",
        body: "主题、练习偏好、自制词库缓存、音频缓存、学习提醒等可能仅保存在你的设备上。",
      },
    ],
    s1Notify:
      "若你开启系统通知权限，我们仅用于学习提醒等你主动设置的功能。你可以随时在系统设置中关闭。",
    s2Title: "2. 我们如何使用信息",
    s2Items: [
      "创建并维护你的账号，同步学习进度与会员权益。",
      "完成购买核销、发放会员时长与钻石，处理退款或异常订单。",
      "在你请求为词库中没有的单词生成练习题目时，将相关单词提交给人工智能服务，并按实际用量扣减钻石。",
      "发送邮箱验证码、处理反馈，以及改进产品稳定性。",
      "遵守适用法律法规、应对安全事件或响应有权机关的合法要求。",
    ],
    s2Footer: "我们不会出售你的个人信息。",
    s3Title: "3. 第三方 SDK 共享个人信息清单",
    s3IntroBefore:
      "为保障 App 相关功能的实现与安全稳定运行，我们接入了第三方 SDK。这些 SDK 可能会收集或使用你的相关信息。我们已对 SDK 进行安全评估，并要求其仅在实现功能所必需的范围内处理信息。以下清单依据全国 SDK 管理服务平台（",
    s3IntroAfter:
      "）及 SDK 官方公开说明整理，供你查阅各 SDK 的基本信息。你可在首次启动 App 时阅读并选择是否同意本政策；在同意前，我们不会初始化涉及个人信息处理的第三方 SDK。",
    s3Headers: [
      "SDK 名称",
      "SDK 开发者",
      "使用平台/场景",
      "收集个人信息范围",
      "使用目的",
      "SDK 隐私政策链接",
    ],
    s3View: "查看",
    s3Sdk: {
      name: "APP支付客户端SDK",
      developer: "支付宝(杭州)信息技术有限公司",
      scope:
        "AndroidID、OAID、IDFV、传感器信息（传感器列表）、设备屏幕密度、运营商信息、WiFi 参数、网络类型",
      purpose:
        "保障用户账户和资金安全以及支付服务的安全稳定运行；履行反洗钱、反恐怖融资、反电信网络诈骗等法定义务；实现网络链路的选择和优化，以提升支付体验",
      platform: "Android（会员支付）",
    },
    s3FooterBefore:
      "上表信息与全国 SDK 管理服务平台登记内容一致。其中「APP支付客户端SDK」（包名 com.alipay.sdk）收集的信息类型与使用目的，以其官方",
    s3FooterLink: "隐私政策",
    s3FooterAfter: "为准。",
    s4Title: "4. 其他第三方服务",
    s4Intro:
      "除上述嵌入 App 的 SDK 外，为完成服务端支付核销、存储、邮件与内容生成，我们还可能与下列类别的服务商共享必要信息。他们仅能在提供相应服务所需范围内处理数据，并应提供不低于本政策的保护：",
    s4Items: [
      "Apple（App Store、App 内购买与订阅管理）",
      "云存储与内容分发（词库资源、题目音频、头像等文件）",
      "邮件服务商（验证码与账号安全相关邮件）",
      "人工智能服务商（仅在你请求为词库中没有的单词生成练习题目时，处理你提交的生成请求）",
    ],
    s5Title: "5. 存储与保留",
    s5Body:
      "账号与学习数据通常保存在中华人民共和国境内的服务器。只要你的账号存续，我们会保留提供服务所必需的信息；在你申请删除账号、或法律不再要求保留后，我们将删除或匿名化相关数据，法律法规另有规定的除外。",
    s6Title: "6. 你的权利",
    s6Items: [
      "查阅、更正昵称、头像、邮箱等账号资料。",
      "在系统设置中管理通知、取消 Apple 订阅。",
      null, // rendered specially with mailto
      "可随时撤回非必要权限（如通知）；不影响你继续使用核心学习功能。",
    ],
    s6DeleteBefore:
      "在 App 内删除账号：登录后打开「我的 → 删除账号」，确认密码后即可删除账号及学习数据。删除后进度、会员与钻石无法恢复。若你开通了 Apple 自动续费订阅，还需在系统「订阅」中自行取消，否则仍可能被扣款。需要导出数据或遇到问题，可发邮件至",
    s6DeleteAfter: "。",
    s7Title: "7. 未成年人",
    s7Body:
      "本产品主要面向有独立使用能力的用户。若你是未成年人，请在监护人同意与指导下使用。监护人如需查阅或删除相关信息，可通过本政策载明的联系方式与我们联系。",
    s8Title: "8. 政策更新",
    s8Body:
      "我们可能适时更新本政策。更新后会在本页面公布，并视情况通过应用内提示等方式通知。若更新导致处理你个人信息的目的、方式或种类发生重大变化，我们将再次征得你的同意。",
    s9Title: "9. 联系我们",
    privacyPageLabel: "App 隐私政策页面",
  },
  ja: {
    metaTitle: "倉鼠単語プライバシーポリシー",
    metaDescription:
      "倉鼠単語のプライバシーポリシー：言词科技がどのように個人情報を収集・利用・保存・保護するか、および App に組み込まれた第三者 SDK について説明します。",
    updatedAt: "2026年9月2日",
    updatedLabel: "最終更新日",
    eyebrow: "Legal",
    title: "プライバシーポリシー",
    lead:
      "本ポリシーは、言词科技（大连）有限公司（以下「当社」）が運営する英単語学習ソフトウェア「倉鼠単語」および関連アカウントサービスに適用されます。本製品を利用することにより、本ポリシーを読み理解したものとみなされます。同意できない場合は、利用を中止してください。",
    s1Title: "1. 収集する情報",
    s1Intro: "当社はサービス提供に必要な情報のみを収集します。主なものは次のとおりです。",
    s1Items: [
      {
        term: "アカウント情報：",
        body: "ユーザー名、パスワード（暗号化して保存）、ニックネーム、任意で連携するメールアドレス、アイコン。",
      },
      {
        term: "学習データ：",
        body: "単語練習の進捗、解答記録、自作単語帳の内容など。",
      },
      {
        term: "会員・取引情報：",
        body: "会員ステータス、ダイヤ残高、注文および支払い結果。iOS では App Store の取引証明、Android では Alipay（支付宝）の取引情報が含まれる場合があります。完全な銀行カード番号は保存しません。",
      },
      {
        term: "フィードバック・カスタマーサポート：",
        body: "ご自身が送信した問い合わせ内容、連絡先情報。",
      },
      {
        term: "端末・ログ情報：",
        body: "アクセス統計や障害調査のため、端末の種類、OS バージョン、おおよそのアクセス時刻などを記録する場合があります。これらは現実の身元特定には用いません。",
      },
      {
        term: "端末内データ：",
        body: "テーマ、練習設定、自作単語帳のキャッシュ、音声キャッシュ、学習リマインダーなどは、端末内のみに保存される場合があります。",
      },
    ],
    s1Notify:
      "システム通知の権限をオンにした場合、学習リマインダーなどご自身が設定した機能にのみ使用します。いつでもシステム設定からオフにできます。",
    s2Title: "2. 情報の利用目的",
    s2Items: [
      "アカウントの作成・維持、学習進捗および会員特典の同期。",
      "購入の照合、会員期間やダイヤの付与、返金または異常注文の対応。",
      "単語帳にない単語の練習問題生成を依頼された場合、当該単語を AI サービスへ送信し、実使用量に応じてダイヤを差し引くこと。",
      "メール認証コードの送信、フィードバック対応、製品の安定性向上。",
      "適用法令の遵守、セキュリティ事案への対応、または権限ある機関からの適法な要請への対応。",
    ],
    s2Footer: "当社は個人情報を売却しません。",
    s3Title: "3. 第三者 SDK による個人情報の共有一覧",
    s3IntroBefore:
      "App の機能実現および安全・安定した運用のため、第三者 SDK を組み込んでいます。これらの SDK は関連情報を収集または利用する場合があります。当社は SDK のセキュリティ評価を行い、機能実現に必要な範囲でのみ情報を処理するよう求めています。以下の一覧は、中国全国 SDK 管理サービスプラットフォーム（",
    s3IntroAfter:
      "）および各 SDK の公式公開説明に基づき整理したものです。初回起動時に本ポリシーを確認し、同意するかどうかを選択できます。同意前には、個人情報の処理を伴う第三者 SDK を初期化しません。",
    s3Headers: [
      "SDK 名称",
      "SDK 開発者",
      "利用プラットフォーム／場面",
      "収集する個人情報の範囲",
      "利用目的",
      "SDK プライバシーポリシー",
    ],
    s3View: "表示",
    s3Sdk: {
      name: "APP支付客户端SDK",
      developer: "支付宝(杭州)信息技术有限公司",
      scope:
        "AndroidID、OAID、IDFV、センサー情報（センサー一覧）、画面密度、通信事業者情報、Wi‑Fi パラメータ、ネットワーク種別",
      purpose:
        "ユーザーアカウントおよび資金の安全、ならびに決済サービスの安定運用の確保；マネーロンダリング防止・テロ資金供与防止・通信ネットワーク詐欺防止等の法的義務の履行；回線選択と最適化による決済体験の向上",
      platform: "Android（会員決済）",
    },
    s3FooterBefore:
      "上表の情報は全国 SDK 管理サービスプラットフォームの登録内容と一致します。「APP支付客户端SDK」（パッケージ名 com.alipay.sdk）が収集する情報の種類および利用目的は、公式の",
    s3FooterLink: "プライバシーポリシー",
    s3FooterAfter: "に従います。",
    s4Title: "4. その他の第三者サービス",
    s4Intro:
      "上記の App 埋め込み SDK に加え、サーバー側の決済照合、保存、メール、コンテンツ生成のため、次のカテゴリの事業者と必要情報を共有する場合があります。これらは該当サービスの提供に必要な範囲でのみデータを処理し、本ポリシーと同等以上の保護を提供するものとします。",
    s4Items: [
      "Apple（App Store、アプリ内課金およびサブスクリプション管理）",
      "クラウドストレージおよびコンテンツ配信（単語帳リソース、問題音声、アイコン等のファイル）",
      "メールサービス提供者（認証コードおよびアカウントセキュリティ関連メール）",
      "人工知能サービス提供者（単語帳にない単語の練習問題生成を依頼した場合に限り、送信された生成リクエストを処理）",
    ],
    s5Title: "5. 保存と保持",
    s5Body:
      "アカウントおよび学習データは、通常、中華人民共和国国内のサーバーに保存されます。アカウントが存続する限り、サービス提供に必要な情報を保持します。アカウント削除の申請後、または法令上保持が不要となった後は、法令に別段の定めがある場合を除き、関連データを削除または匿名化します。",
    s6Title: "6. お客様の権利",
    s6Items: [
      "ニックネーム、アイコン、メールアドレスなどのアカウント情報の閲覧・訂正。",
      "システム設定での通知管理、Apple サブスクリプションの解約。",
      null,
      "通知など必須でない権限はいつでも撤回できます。コアとなる学習機能の利用には影響しません。",
    ],
    s6DeleteBefore:
      "App 内でのアカウント削除：ログイン後「マイページ → アカウント削除」を開き、パスワードを確認するとアカウントおよび学習データを削除できます。削除後、進捗・会員・ダイヤは復元できません。Apple の自動更新サブスクリプションを契約している場合は、システム「サブスクリプション」から別途解約してください。解約しないと課金が続くことがあります。データのエクスポートや不具合については、次のメールまでご連絡ください：",
    s6DeleteAfter: "。",
    s7Title: "7. 未成年者",
    s7Body:
      "本製品は、主に自ら利用できるユーザーを対象としています。未成年の方は、保護者の同意と指導の下でご利用ください。保護者が関連情報の閲覧または削除を希望する場合は、本ポリシー記載の連絡先までご連絡ください。",
    s8Title: "8. ポリシーの更新",
    s8Body:
      "当社は必要に応じて本ポリシーを更新することがあります。更新後は本ページに掲載し、状況に応じてアプリ内通知などでお知らせします。個人情報の取扱い目的・方法・種類に重大な変更がある場合は、改めて同意を取得します。",
    s9Title: "9. お問い合わせ",
    privacyPageLabel: "App プライバシーポリシーページ",
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

export default function HamsterPrivacyPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const lang = resolveHamsterLang(searchParams);
  const c = COPY[lang];
  const sdk = c.s3Sdk;

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
          <p>{c.s1Intro}</p>
          <ul>
            {c.s1Items.map((item) => (
              <li key={item.term}>
                <span className={styles.legal__term}>{item.term}</span>
                {item.body}
              </li>
            ))}
          </ul>
          <p>{c.s1Notify}</p>
        </section>

        <section>
          <h2>{c.s2Title}</h2>
          <ul>
            {c.s2Items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p>{c.s2Footer}</p>
        </section>

        <section>
          <h2>{c.s3Title}</h2>
          <p>
            {c.s3IntroBefore}
            <a
              href="https://sdk.caict.ac.cn/official/#/home"
              target="_blank"
              rel="noopener noreferrer"
            >
              sdk.caict.ac.cn
            </a>
            {c.s3IntroAfter}
          </p>

          <div className={styles.legal__tableWrap}>
            <table className={styles.legal__table}>
              <thead>
                <tr>
                  {c.s3Headers.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{sdk.name}</td>
                  <td>{sdk.developer}</td>
                  <td>{sdk.platform}</td>
                  <td>{sdk.scope}</td>
                  <td>{sdk.purpose}</td>
                  <td>
                    <a
                      href={ALIPAY_SDK_POLICY_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {c.s3View}
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p>
            {c.s3FooterBefore}
            <a
              href={ALIPAY_SDK_POLICY_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              {c.s3FooterLink}
            </a>
            {c.s3FooterAfter}
          </p>
        </section>

        <section>
          <h2>{c.s4Title}</h2>
          <p>{c.s4Intro}</p>
          <ul>
            {c.s4Items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section>
          <h2>{c.s5Title}</h2>
          <p>{c.s5Body}</p>
        </section>

        <section>
          <h2>{c.s6Title}</h2>
          <ul>
            <li>{c.s6Items[0]}</li>
            <li>{c.s6Items[1]}</li>
            <li>
              {c.s6DeleteBefore}
              <a href="mailto:baseheng@qq.com">baseheng@qq.com</a>
              {c.s6DeleteAfter}
            </li>
            <li>{c.s6Items[3]}</li>
          </ul>
        </section>

        <section>
          <h2>{c.s7Title}</h2>
          <p>{c.s7Body}</p>
        </section>

        <section>
          <h2>{c.s8Title}</h2>
          <p>{c.s8Body}</p>
        </section>

        <section>
          <h2>{c.s9Title}</h2>
          <ContactBlock
            lang={lang}
            extra={
              <>
                <br />
                {c.privacyPageLabel}：
                <a href={PRIVACY_PAGE_URL}>
                  qiaoqiaoengapp.word19.com/hamster/privacy
                </a>
              </>
            }
          />
        </section>
      </article>
    </CompanyShell>
  );
}
