import type { Metadata } from "next";
import Link from "next/link";
import { CompanyShell } from "@/components/company/CompanyShell";
import styles from "@/components/company/company.module.css";

export const metadata: Metadata = {
  title: "敲敲英语用户指南",
  description:
    "敲敲英语用户指南：看中文、听发音、自己敲出英文。闯关、系列课程、每日一课、自制课程与生词复习。",
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
          「敲敲英语」是打字练习：先看中文提示、听标准读音，再亲手把单词或整句敲出来。系统即时纠错。它不是选择题 App。仓鼠单词请看
          <Link href="/hamster/guide">《仓鼠单词用户指南》</Link>。
        </p>

        <section>
          <h2>1. 怎么练</h2>
          <ul>
            <li>屏幕上方是中文意思，可点播放听发音。</li>
            <li>用键盘自己拼出对应英文。敲错会立刻标红，改对后再继续。</li>
            <li>空格可跳到下一个词。需要偷看英文时，按练习设置里的快捷键。</li>
            <li>练完一课会按正确率和过程记星。闯关里攒星可解锁后面的阶段。</li>
          </ul>
        </section>

        <section>
          <h2>2. 洞口课堂</h2>
          <p>首页「洞口课堂」是官方主路径，三块：</p>
          <ul>
            <li>
              <strong>闯关</strong>
              ：五阶段成长路径，依次是萌芽、知微、渐成、卓然、登峰。上一阶段攒够星，才能开下一阶段。
            </li>
            <li>
              <strong>系列课程</strong>
              ：按主题系统学。路线是初识、开口、读懂、写出、交流、通话，从认识身边的词，练到真实场景和打电话。
            </li>
            <li>
              <strong>每日一课</strong>
              ：牛津 3000 词，大约八分钟一课，适合每天打卡。
            </li>
          </ul>
        </section>

        <section>
          <h2>3. 自挖工坊</h2>
          <ul>
            <li>
              <strong>自制课程</strong>
              ：输入单词或一句话，生成专属打字练习。创建会消耗钻石。
            </li>
            <li>
              <strong>课程广场</strong>
              ：浏览别人分享的打字课，添加到自己的列表。
            </li>
            <li>
              <strong>我的课程</strong>
              ：自制课和从广场添加的课都在这里。
            </li>
          </ul>
        </section>

        <section>
          <h2>4. 粮仓小记</h2>
          <ul>
            <li>
              <strong>生词卡</strong>
              ：答对后点加号收藏单词，按日期复习；也可做听写。
            </li>
            <li>
              <strong>收藏句</strong>
              ：收藏整句，按日期复习或听写。
            </li>
            <li>
              <strong>学习统计</strong>
              ：看课程、单词和复习的概览。
            </li>
            <li>
              <strong>学习提醒</strong>
              ：设定时间，到点来敲。
            </li>
            <li>首页还可看闯关星级排行（总榜、今日榜）。</li>
          </ul>
        </section>

        <section>
          <h2>5. 练习设置</h2>
          <p>练习页可开关这些项（以 App 内为准）：</p>
          <ul>
            <li>中文提示、按键音效、键盘快捷键提示。</li>
            <li>输入时隐藏英文，需要时再按住偷看。</li>
            <li>每日一课可换朗读音色。</li>
          </ul>
        </section>

        <section>
          <h2>6. 会员与钻石</h2>
          <ul>
            <li>部分课程和功能需要登录或开通会员。</li>
            <li>钻石用于自制课程等需要生成内容的功能。</li>
            <li>iOS 走 App Store；安卓可使用支付宝。</li>
            <li>
              开通前请阅读
              <Link href="/vip-agreement">《会员服务协议》</Link>。
            </li>
          </ul>
        </section>

        <section>
          <h2>7. 账号与设置</h2>
          <ul>
            <li>建议登录后使用，进度、会员和钻石会跟账号走。</li>
            <li>可在设置中改昵称、密码、头像，或申请删除账号。</li>
            <li>
              隐私说明见
              <Link href="/privacy">《隐私政策》</Link>
              ；完整规则见
              <Link href="/terms">《用户协议》</Link>。
            </li>
          </ul>
        </section>

        <section>
          <h2>8. 联系我们</h2>
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
