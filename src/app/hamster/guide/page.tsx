import type { Metadata } from "next";
import Link from "next/link";
import { CompanyShell } from "@/components/company/CompanyShell";
import styles from "@/components/company/company.module.css";

export const metadata: Metadata = {
  title: "仓鼠单词用户指南",
  description:
    "仓鼠单词用户指南：如何选词库、做练习、设学习计划，以及会员与钻石的用法。",
};

const UPDATED_AT = "2026年9月3日";

export default function HamsterGuidePage() {
  return (
    <CompanyShell>
      <article className={styles.legal}>
        <p className={styles.legal__eyebrow}>Guide</p>
        <h1>仓鼠单词用户指南</h1>
        <p className={styles.legal__updated}>最近更新日期：{UPDATED_AT}</p>
        <p className={styles.legal__lead}>
          「仓鼠单词」把常用英语单词装进口袋，每天练一点。下面说明首页、练习和会员怎么用。敲敲英语请看
          <Link href="/guide">《敲敲英语用户指南》</Link>。
        </p>

        <section>
          <h2>1. 首页词库</h2>
          <ul>
            <li>首页大卡片、小卡片和列表里的词库可以自定义，入口在「学习设置 → 首页词库」。</li>
            <li>点进词库就开始练。进度会记在本机，登录后会员和钻石跟账号走。</li>
            <li>也可以把单词做成自制词库，反复练自己那一份。</li>
          </ul>
        </section>

        <section>
          <h2>2. 练习</h2>
          <p>题型包括：看中写英、听音辨词、听音拼写、释义选择、句中选义、听句选译、句中填空、拖拽组句。</p>
          <ul>
            <li>「学习设置 → 练习设置」可开关音效，以及自定义朗读音色。</li>
            <li>句中选义会高亮句子里的目标词，请选择它的中文意思。</li>
            <li>做完一组可以看对错和用时；中途退出也可。</li>
          </ul>
        </section>

        <section>
          <h2>3. 学习计划与排行</h2>
          <ul>
            <li>「自定义学习计划」用来安排每天的量，按自己的节奏来。</li>
            <li>「学习排行」按答对题数看周榜和月榜。</li>
            <li>可开启练习提醒，到点会通知你来练。</li>
          </ul>
        </section>

        <section>
          <h2>4. 会员与钻石</h2>
          <ul>
            <li>会员可解除练习次数等限制，开通时可能附赠钻石。</li>
            <li>钻石用于生成题目等需要计算的功能。</li>
            <li>iOS 走 App Store；安卓可使用支付宝。</li>
            <li>VIP 页可查看「会员充值记录」（只记增加的天数，不含兑换码）。</li>
            <li>开通前请阅读 <Link href="/hamster/vip-agreement">《会员服务协议》</Link>。</li>
          </ul>
        </section>

        <section>
          <h2>5. 账号与设置</h2>
          <ul>
            <li>建议登录后使用，方便同步会员和钻石。</li>
            <li>可在「我」里改昵称、密码、头像，或申请删除账号。</li>
            <li>隐私说明见 <Link href="/hamster/privacy">《隐私政策》</Link>；完整规则见 <Link href="/hamster/terms">《用户协议》</Link>。</li>
          </ul>
        </section>

        <section>
          <h2>6. 联系我们</h2>
          <p>
            运营者：言词科技（大连）有限公司
            <br />
            产品：仓鼠单词
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
