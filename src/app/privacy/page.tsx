import type { Metadata } from "next";
import { CompanyShell } from "@/components/company/CompanyShell";
import styles from "@/components/company/company.module.css";

export const metadata: Metadata = {
  title: "隐私政策",
  description:
    "言词科技隐私政策：说明我们如何收集、使用、存储与保护你的个人信息。",
};

const UPDATED_AT = "2026年8月17日";

export default function PrivacyPage() {
  return (
    <CompanyShell>
      <article className={styles.legal}>
        <p className={styles.legal__eyebrow}>Legal</p>
        <h1>隐私政策</h1>
        <p className={styles.legal__updated}>最近更新日期：{UPDATED_AT}</p>
        <p className={styles.legal__lead}>
          本政策适用于言词科技（大连）有限公司运营的英语学习软件、网站（yancilanguage.cn）及相关账号服务。使用我们的产品或网站即表示你已阅读并理解本政策。若你不同意，请停止使用。
        </p>

        <section>
          <h2>1. 我们收集的信息</h2>
          <p>我们仅收集提供服务所必要的信息，主要包括：</p>
          <ul>
            <li>
              <span className={styles.legal__term}>账号信息：</span>
              用户名、密码（加密存储）、昵称、可选绑定的邮箱、头像。
            </li>
            <li>
              <span className={styles.legal__term}>学习数据：</span>
              课程进度、练习记录、生词本、收藏句子、自制课程内容等。
            </li>
            <li>
              <span className={styles.legal__term}>会员与交易：</span>
              会员状态、钻石余额、订单与支付结果。iOS 上可能包含 App Store
              交易凭证；Android
              上可能包含支付宝交易信息。我们不会存储完整银行卡号。
            </li>
            <li>
              <span className={styles.legal__term}>反馈与客服：</span>
              你主动提交的问题描述、联系方式（如微信号）。
            </li>
            <li>
              <span className={styles.legal__term}>设备与日志：</span>
              为统计访问、排查故障，可能记录设备类型、系统版本、大致访问时间等，不用于识别你的现实身份。
            </li>
            <li>
              <span className={styles.legal__term}>本地数据：</span>
              主题、练习偏好、音频缓存、学习提醒等可能仅保存在你的设备上。
            </li>
          </ul>
          <p>
            若你开启系统通知权限，我们仅用于学习提醒等你主动设置的功能。你可以随时在系统设置中关闭。
          </p>
        </section>

        <section>
          <h2>2. 我们如何使用信息</h2>
          <ul>
            <li>创建并维护你的账号，同步学习进度与会员权益。</li>
            <li>完成购买核销、发放会员时长与钻石，处理退款或异常订单。</li>
            <li>生成或保存你请求的自制课程，并按用量扣减钻石。</li>
            <li>发送邮箱验证码、处理反馈，以及改进产品稳定性。</li>
            <li>遵守适用法律法规、应对安全事件或响应有权机关的合法要求。</li>
          </ul>
          <p>我们不会出售你的个人信息。</p>
        </section>

        <section>
          <h2>3. 第三方服务</h2>
          <p>
            为完成支付、存储、邮件与内容生成，我们可能与下列类别的服务商共享必要信息。他们仅能在提供相应服务所需范围内处理数据，并应提供不低于本政策的保护：
          </p>
          <ul>
            <li>Apple（App Store、App 内购买与订阅管理）</li>
            <li>支付宝（Android 等平台的支付）</li>
            <li>云存储与内容分发（课程资源、头像等文件）</li>
            <li>邮件服务商（验证码与账号安全相关邮件）</li>
            <li>
              人工智能服务商（仅在你使用自制课程等功能时，处理你提交的生成请求）
            </li>
          </ul>
          <p>
            本网站可能使用匿名化统计分析工具，用于了解页面访问情况。iOS App
            内购买还受 Apple 的隐私政策与标准许可协议约束。
          </p>
        </section>

        <section>
          <h2>4. 存储与保留</h2>
          <p>
            账号与学习数据通常保存在中华人民共和国境内的服务器。只要你的账号存续，我们会保留提供服务所必需的信息；在你申请删除账号、或法律不再要求保留后，我们将删除或匿名化相关数据，法律法规另有规定的除外。
          </p>
        </section>

        <section>
          <h2>5. 你的权利</h2>
          <ul>
            <li>查阅、更正昵称、头像、邮箱等账号资料。</li>
            <li>在系统设置中管理通知、取消 Apple 订阅。</li>
            <li>
              申请导出或删除账号与相关数据。请发送邮件至
              <a href="mailto:baseheng@qq.com">baseheng@qq.com</a>
              ，我们将在核实身份后处理。删除后学习进度、会员与钻石可能无法恢复。
            </li>
            <li>
              可随时撤回非必要权限（如通知）；不影响你继续使用核心学习功能。
            </li>
          </ul>
        </section>

        <section>
          <h2>6. 未成年人</h2>
          <p>
            本产品主要面向有独立使用能力的用户。若你是未成年人，请在监护人同意与指导下使用。监护人如需查阅或删除相关信息，可通过本政策载明的联系方式与我们联系。
          </p>
        </section>

        <section>
          <h2>7. 政策更新</h2>
          <p>
            我们可能适时更新本政策。更新后会在本页面公布，并视情况通过应用内提示等方式通知。若更新导致处理你个人信息的目的、方式或种类发生重大变化，我们将再次征得你的同意。
          </p>
        </section>

        <section>
          <h2>8. 联系我们</h2>
          <p>
            运营者：言词科技（大连）有限公司
            <br />
            网站：
            <a href="https://yancilanguage.cn/">yancilanguage.cn</a>
            <br />
            邮箱：
            <a href="mailto:baseheng@qq.com">baseheng@qq.com</a>
            <br />
            微信：535938559
          </p>
        </section>
      </article>
    </CompanyShell>
  );
}
