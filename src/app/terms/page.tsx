import type { Metadata } from "next";
import Link from "next/link";
import { CompanyShell } from "@/components/company/CompanyShell";
import styles from "@/components/company/company.module.css";

export const metadata: Metadata = {
  title: "用户协议",
  description:
    "言词科技用户协议：说明你使用我们产品与服务时应遵循的规则与双方权利义务。",
};

const UPDATED_AT = "2026年8月19日";

export default function TermsPage() {
  return (
    <CompanyShell hideChrome>
      <article className={styles.legal}>
        <p className={styles.legal__eyebrow}>Legal</p>
        <h1>用户协议</h1>
        <p className={styles.legal__updated}>最近更新日期：{UPDATED_AT}</p>
        <p className={styles.legal__lead}>
          本协议是你与言词科技（大连）有限公司（下称「我们」）之间，就使用英语学习软件「敲敲英语」、网站（yancilanguage.cn）及相关账号服务所订立的协议。请你在使用前仔细阅读。使用本服务即表示你已阅读、理解并同意本协议；若你不同意，请停止使用。
        </p>

        <section>
          <h2>1. 协议范围</h2>
          <p>
            本协议适用于我们提供的客户端应用、网站及相关功能（包括但不限于课程学习、练习、生词本、收藏句子、自制课程、会员与钻石、反馈与客服等）。关于个人信息的收集与使用，请另行阅读
            <Link href="/privacy">《隐私政策》</Link>
            ；开通 VIP 前请阅读
            <Link href="/vip-agreement">《会员服务协议》</Link>。
          </p>
        </section>

        <section>
          <h2>2. 账号注册与安全</h2>
          <ul>
            <li>
              你应使用真实、合法的信息注册账号，并对账号下的行为负责。
            </li>
            <li>
              请妥善保管用户名与密码。因你保管不善导致的损失，由你自行承担，法律法规另有规定的除外。
            </li>
            <li>
              发现账号被盗用或存在安全风险时，请及时通过本协议载明的联系方式通知我们。
            </li>
            <li>
              你可以在 App 内申请删除账号；删除后学习进度、会员与钻石等权益通常无法恢复，具体以产品内说明为准。
            </li>
          </ul>
        </section>

        <section>
          <h2>3. 服务内容</h2>
          <p>
            我们向你提供英语学习相关的内容与工具。部分功能可能需要登录、开通会员或消耗钻石。我们可能根据业务需要调整功能、界面或计费方式，并尽量通过应用内或网站进行说明。
          </p>
        </section>

        <section>
          <h2>4. 会员、付费与虚拟物品</h2>
          <ul>
            <li>
              会员时长、钻石等属于虚拟商品或服务权益，购买前请确认套餐说明与价格。
            </li>
            <li>
              iOS 上的购买与自动续费受 Apple 相关规则约束；Android
              等平台可能通过支付宝等第三方完成支付。
            </li>
            <li>
              除法律法规另有规定或我们书面承诺外，虚拟商品一经售出通常不支持退换；因系统故障导致重复扣款等异常，我们将在核实后妥善处理。
            </li>
            <li>
              若你开通自动续费，取消方式以各应用商店或支付渠道的规则为准（例如在
              Apple「订阅」中管理）。
            </li>
          </ul>
        </section>

        <section>
          <h2>5. 用户行为规范</h2>
          <p>你承诺不得利用本服务从事以下行为，包括但不限于：</p>
          <ul>
            <li>发布、传播违法违规、侵权、骚扰或不良信息；</li>
            <li>侵犯他人知识产权、肖像权、隐私权等合法权益；</li>
            <li>破解、干扰、滥用系统或接口，或进行未经授权的访问；</li>
            <li>利用本服务从事欺诈、洗钱或其他违法活动；</li>
            <li>其他违反法律法规、本协议或公序良俗的行为。</li>
          </ul>
          <p>
            若你违反上述规范，我们有权视情节采取警告、限制功能、暂停或终止服务、删除违规内容等措施，并保留依法追究责任的权利。
          </p>
        </section>

        <section>
          <h2>6. 知识产权</h2>
          <p>
            本服务中的软件、界面设计、文案、课程内容、商标标识等知识产权归我们或合法权利人所有，受法律保护。未经书面许可，你不得复制、传播、改编、反向工程或以其他方式用于商业目的。
          </p>
          <p>
            你在自制课程、反馈等场景中主动提交的内容，仍由你依法享有相应权利；你授予我们在提供与改进服务所必需范围内使用、存储与展示该等内容的许可。
          </p>
        </section>

        <section>
          <h2>7. 免责与责任限制</h2>
          <ul>
            <li>
              我们将尽力保障服务稳定，但不对因不可抗力、网络故障、第三方服务中断等原因造成的暂时不可用作出绝对承诺。
            </li>
            <li>
              学习效果因人而异，本服务不构成任何考试通过、就业或成绩方面的保证。
            </li>
            <li>
              在法律允许的最大范围内，我们对间接损失、预期利益损失等不承担责任；我们承担的赔偿责任以你就相关争议所支付的费用为限（法律法规另有规定的除外）。
            </li>
          </ul>
        </section>

        <section>
          <h2>8. 协议变更与终止</h2>
          <p>
            我们可能适时修订本协议，并在本页面公布更新日期。若变更涉及重大权利义务调整，我们将视情况通过应用内提示等方式告知。你继续使用服务即视为接受修订后的协议。
          </p>
          <p>
            你可以随时停止使用并按产品指引删除账号。我们也可在你严重违约、依法需要、或服务停止运营等情形下，限制或终止向你提供服务。
          </p>
        </section>

        <section>
          <h2>9. 适用法律与争议解决</h2>
          <p>
            本协议的订立、效力、解释与履行适用中华人民共和国法律（不含冲突规范）。因本协议产生的争议，双方应友好协商；协商不成的，提交我们所在地有管辖权的人民法院诉讼解决。
          </p>
        </section>

        <section>
          <h2>10. 联系我们</h2>
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
