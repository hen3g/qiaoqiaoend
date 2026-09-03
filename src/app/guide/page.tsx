import type { Metadata } from "next";
import Link from "next/link";
import { CompanyShell } from "@/components/company/CompanyShell";
import styles from "@/components/company/company.module.css";

export const metadata: Metadata = {
  title: "敲敲英语用户指南",
  description:
    "敲敲英语用户指南：如何开始学习、练习、自制课程，以及会员与钻石的用法。",
};

const UPDATED_AT = "2026年9月3日";

export default function QiaoqiaoGuidePage() {
  return (
    <CompanyShell>
      <article className={styles.legal}>
        <p className={styles.legal__eyebrow}>Guide</p>
        <h1>敲敲英语用户指南</h1>
        <p className={styles.legal__updated}>最近更新日期：{UPDATED_AT}</p>
        <p className={styles.legal__lead}>
          「敲敲英语」帮你把看得懂的英语，练成写得出、说得出。下面按使用顺序说明常用功能。仓鼠单词请看
          <Link href="/hamster/guide">《仓鼠单词用户指南》</Link>。
        </p>

        <section>
          <h2>1. 开始学习</h2>
          <ul>
            <li>打开 App 后，从首页课程或套卷进入练习。</li>
            <li>每课按你的进度推进。可以随时退出，下次会从上次停下的地方继续。</li>
            <li>不会的词可以跳过或稍后复习，不必一次全部搞定。</li>
          </ul>
        </section>

        <section>
          <h2>2. 练习怎么做</h2>
          <p>常见题型包括：看中写英、听音辨词、听音拼写、释义选择、句中选义、听句选译、句中填空、拖拽组句。</p>
          <ul>
            <li>答对会进入下一题；答错可以看解析后再继续。</li>
            <li>需要发音时点播放。可在设置里调整音效和音色。</li>
            <li>遇到题目有误，可在练习中反馈，我们会抽查修正。</li>
          </ul>
        </section>

        <section>
          <h2>3. 自制课程</h2>
          <ul>
            <li>把你的单词或材料做成专属课，方便反复练。</li>
            <li>生成题目会消耗钻石。余额不足时请先充值或开通会员。</li>
            <li>做好的课可以留着自己用；若开启分享，也可能出现在课程广场。</li>
          </ul>
        </section>

        <section>
          <h2>4. 会员与钻石</h2>
          <ul>
            <li>会员用于解除练习次数等限制，并可能附赠钻石。</li>
            <li>钻石用于自制课等需计算资源的功能。</li>
            <li>iOS 走 App Store 支付；安卓可使用支付宝。</li>
            <li>开通前请阅读 <Link href="/vip-agreement">《会员服务协议》</Link>。</li>
          </ul>
        </section>

        <section>
          <h2>5. 账号与设置</h2>
          <ul>
            <li>建议登录后使用，学习进度和会员会跟账号走。</li>
            <li>可在设置中修改昵称、密码、绑定邮箱，或申请删除账号。</li>
            <li>隐私相关说明见 <Link href="/privacy">《隐私政策》</Link>；完整规则见 <Link href="/terms">《用户协议》</Link>。</li>
          </ul>
        </section>

        <section>
          <h2>6. 联系我们</h2>
          <p>
            运营者：言词科技（大连）有限公司
            <br />
            产品：敲敲英语
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
