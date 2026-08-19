import type { Metadata } from "next";
import Link from "next/link";
import { CompanyShell } from "@/components/company/CompanyShell";
import styles from "@/components/company/company.module.css";

export const metadata: Metadata = {
  title: "会员服务协议",
  description:
    "敲敲英语会员服务协议：说明 VIP 会员权益、付费规则、自动续费与退款等事项。",
};

const UPDATED_AT = "2026年8月19日";

export default function VipAgreementPage() {
  return (
    <CompanyShell>
      <article className={styles.legal}>
        <p className={styles.legal__eyebrow}>Legal</p>
        <h1>会员服务协议</h1>
        <p className={styles.legal__updated}>最近更新日期：{UPDATED_AT}</p>
        <p className={styles.legal__lead}>
          本协议是你与言词科技（大连）有限公司（下称「我们」）之间，就「敲敲英语」VIP
          会员服务订立的协议。请在开通或续费前仔细阅读。点击同意、勾选或完成支付，即表示你已阅读并同意本协议。若你不同意，请不要购买或续费。
        </p>

        <section>
          <h2>1. 服务说明</h2>
          <p>
            VIP
            会员是我们向付费用户提供的增值学习服务。开通后，你可以在会员有效期内使用当时产品界面展示的会员权益（包括但不限于解锁全部课程、会员钻石礼包等）。权益内容可能随产品迭代调整，以购买时及 App
            内公示为准。
          </p>
          <p>
            个人信息处理规则见
            <Link href="/privacy">《隐私政策》</Link>
            ；一般使用规则见
            <Link href="/terms">《用户协议》</Link>。
          </p>
        </section>

        <section>
          <h2>2. 会员套餐与价格</h2>
          <ul>
            <li>
              套餐名称、价格、时长、赠送钻石等，以购买页面实时展示为准。
            </li>
            <li>
              Android 端目前主要通过支付宝完成一次性购买；会员时长自支付成功时起算，可重复购买并叠加有效期。
            </li>
            <li>
              iOS 端可能提供 App 内购买及自动续费订阅（如连续包月）。订阅价格、优惠期、续费周期以
              App Store 商品页及支付界面展示为准，并受 Apple 相关规则约束。
            </li>
            <li>钻石等虚拟物品仅可在本应用内使用，不兑现、不转让。</li>
          </ul>
        </section>

        <section>
          <h2>3. 自动续费（仅适用于开通自动续费的套餐）</h2>
          <ul>
            <li>
              若你选择连续包月等自动续费套餐，首个计费周期结束后，将按公示价格自动续费，直至你取消。
            </li>
            <li>
              iOS 用户可在系统「设置 → Apple 账户 → 订阅」中管理或取消。取消后，当前已付费周期结束前仍可使用会员权益，到期后不再扣款。
            </li>
            <li>
              未在扣款前取消的，视为你同意下一周期续费。因未及时取消产生的续费，按渠道规则处理。
            </li>
          </ul>
        </section>

        <section>
          <h2>4. 支付与到账</h2>
          <ul>
            <li>支付成功后，会员权益与赠送钻石通常立即到账。</li>
            <li>
              若已扣款但权益未到账，请稍后在「我的」中查看，或通过本协议载明的联系方式联系我们，并尽量提供订单时间、金额与支付凭证。
            </li>
            <li>我们不会向你索取银行卡完整卡号或支付密码。</li>
          </ul>
        </section>

        <section>
          <h2>5. 退款与售后</h2>
          <ul>
            <li>
              会员、钻石等虚拟商品一经售出，除法律法规另有规定或我们书面承诺外，通常不支持退换。
            </li>
            <li>
              iOS 内购与订阅的退款，由 Apple 审核处理，你可通过 Apple
              账户申请；我们无法直接撤销 App Store 扣款。
            </li>
            <li>
              Android
              支付宝支付如因系统故障导致重复扣款、未开通成功等，我们将在核实后协助处理（补发权益或按原路退回等）。
            </li>
          </ul>
        </section>

        <section>
          <h2>6. 使用规范与中止</h2>
          <p>
            你不得利用会员权益从事违法违规、侵权、滥用接口、出借或转售账号等行为。情节严重的，我们有权限制、中止或终止相关服务，已支付费用依法不予退还的除外。
          </p>
        </section>

        <section>
          <h2>7. 协议变更</h2>
          <p>
            我们可能适时修订本协议，并在本页面公布。若变更对你的权益有重大影响，我们将尽量通过应用内提示等方式告知。你继续购买或续费即视为接受修订后的协议。
          </p>
        </section>

        <section>
          <h2>8. 联系我们</h2>
          <p>
            运营者：言词科技（大连）有限公司
            <br />
            会员服务协议页面：
            <a href="https://qiaoqiaoengapp.word19.com/vip-agreement">
              qiaoqiaoengapp.word19.com/vip-agreement
            </a>
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
