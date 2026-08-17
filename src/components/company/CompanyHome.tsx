"use client";

import { useEffect, useState } from "react";
import { CompanyShell } from "@/components/company/CompanyShell";
import styles from "./company.module.css";

const PHRASES = [
  "I want to say this sentence.",
  "Practice makes it mine.",
  "Type it. Own it.",
];

export function CompanyHome() {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) {
      setTyped(PHRASES[0]);
      return;
    }

    let phraseIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let timer = 0;

    const tick = () => {
      const current = PHRASES[phraseIndex];
      if (!deleting) {
        charIndex += 1;
        setTyped(current.slice(0, charIndex));
        if (charIndex === current.length) {
          deleting = true;
          timer = window.setTimeout(tick, 1800);
          return;
        }
        timer = window.setTimeout(tick, 52);
        return;
      }

      charIndex -= 1;
      setTyped(current.slice(0, charIndex));
      if (charIndex === 0) {
        deleting = false;
        phraseIndex = (phraseIndex + 1) % PHRASES.length;
        timer = window.setTimeout(tick, 420);
        return;
      }
      timer = window.setTimeout(tick, 28);
    };

    timer = window.setTimeout(tick, 700);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <CompanyShell home>
      <section className={styles.hero}>
        <div>
          <p className={`${styles.hero__eyebrow} ${styles["animate-in"]}`}>
            Yanci Tech · Dalian
          </p>
          <h1
            className={`${styles.hero__brand} ${styles["animate-in"]} ${styles["animate-in--2"]}`}
          >
            言词科技
          </h1>
          <p
            className={`${styles.hero__lead} ${styles["animate-in"]} ${styles["animate-in--3"]}`}
          >
            专注英语学习软件。让学习者亲手把单词和句子敲出来，把“看得懂”变成“用得上”。
          </p>
          <div
            className={`${styles.hero__actions} ${styles["animate-in"]} ${styles["animate-in--4"]}`}
          >
            <a className={`${styles.btn} ${styles["btn--primary"]}`} href="#product">
              了解产品
            </a>
            <a className={`${styles.btn} ${styles["btn--ghost"]}`} href="#contact">
              联系我们
            </a>
          </div>
        </div>

        <div
          className={`${styles.hero__stage} ${styles["animate-in"]} ${styles["animate-in--5"]}`}
          aria-hidden="true"
        >
          <div className={styles["type-panel"]}>
            <div className={styles["type-panel__bar"]}>
              <span />
              <span />
              <span />
            </div>
            <p className={styles["type-panel__hint"]}>看中文 · 听发音 · 敲英文</p>
            <p className={styles["type-panel__zh"]}>我想把这句话说出来。</p>
            <p className={styles["type-panel__en"]}>
              <span>{typed}</span>
              <span className={styles.caret} />
            </p>
          </div>
        </div>
      </section>

      <section id="product" className={`${styles.section} ${styles.product}`}>
        <div className={styles.section__intro}>
          <h2>产品</h2>
          <p>旗下英语学习产品，面向主动输出与真实场景练习。</p>
        </div>

        <article className={styles["product-feature"]}>
          <div className={styles["product-feature__meta"]}>
            <p className={styles["product-feature__name"]}>言词科技</p>
            <p className={styles["product-feature__domain"]}>yancilanguage.cn</p>
            <h3>用键盘敲句子，学英语。</h3>
            <p className={styles["product-feature__desc"]}>
              先听标准读音，再主动回忆，亲手敲出单词或整句。系统即时纠错并记录进度。课程、套卷与听写工具覆盖从启蒙到真实场景的练习路径，也支持用
              AI 自制课程。
            </p>
            <ul className={styles["product-points"]}>
              <li>课程闯关：看中文提示，敲出对应英文</li>
              <li>一词七练套卷：听音、释义、填空多题型巩固词汇</li>
              <li>听写默写：像课堂听写一样练听力与拼写</li>
              <li>系列学习路线：初识、开口、读懂、写出、交流、通话</li>
            </ul>
          </div>
        </article>
      </section>

      <section id="about" className={`${styles.section} ${styles.about}`}>
        <div className={styles.section__intro}>
          <h2>关于言词</h2>
          <p>言词科技（大连）有限公司，做能真正练出口与笔头的英语学习软件。</p>
        </div>
        <div className={styles.about__grid}>
          <div className={styles.about__block}>
            <h3>我们相信什么</h3>
            <p>
              选择题会让人“看起来会了”。真正的进步发生在主动回忆与完整输出里——听、想、敲、立刻纠错，再在后续课程里反复出现。
            </p>
          </div>
          <div className={styles.about__block}>
            <h3>我们做什么</h3>
            <p>
              设计短而完整的练习单元，把词汇、句子和真实情境串成可每天完成的路线；用软件把反馈做得即时、清楚，让学习可以坚持下去。
            </p>
          </div>
          <div className={styles.about__block}>
            <h3>立足大连</h3>
            <p>
              公司位于大连，面向中文学习者打造英语练习产品，持续打磨课程内容与在线体验。
            </p>
          </div>
        </div>
      </section>

      <section id="contact" className={`${styles.section} ${styles.contact}`}>
        <div className={styles.section__intro}>
          <h2>联系我们</h2>
          <p>产品咨询、合作与反馈，欢迎通过以下方式联系。</p>
        </div>
        <div className={styles.contact__rows}>
          <div className={styles.contact__row}>
            <span className={styles.contact__label}>公司</span>
            <span className={styles.contact__value}>言词科技（大连）有限公司</span>
          </div>
          <div className={styles.contact__row}>
            <span className={styles.contact__label}>微信</span>
            <span className={styles.contact__value}>535938559</span>
          </div>
          <div className={styles.contact__row}>
            <span className={styles.contact__label}>邮箱</span>
            <a className={styles.contact__value} href="mailto:baseheng@qq.com">
              baseheng@qq.com
            </a>
          </div>
          <div className={styles.contact__row}>
            <span className={styles.contact__label}>网站</span>
            <a
              className={styles.contact__value}
              href="https://yancilanguage.cn/"
            >
              yancilanguage.cn
            </a>
          </div>
        </div>
      </section>
    </CompanyShell>
  );
}
