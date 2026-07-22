"use client";

import { useEffect, useState } from "react";
import { ONLINE_CLIENT_URL } from "@/lib/online";

type Mode = "course" | "paper" | "tool";
type CoursePhase = "typing" | "correct" | "next";
type PaperPhase = "prompt" | "picked" | "correct";
type ToolPhase = "listen" | "wait" | "next" | "done";

const COURSE_TARGET = "I like apples";
const PAPER_PROMPT = "听音选择正确单词";
const PAPER_OPTIONS = ["apple", "banana", "orange"] as const;
const PAPER_ANSWER = 0;
const TOOL_WORDS = ["apple", "school", "happy"] as const;

const MODE_META: Record<
  Mode,
  { label: string; href: string; blurb: string }
> = {
  course: {
    label: "课程",
    href: new URL("courses", ONLINE_CLIENT_URL).toString(),
    blurb: "看中文、听发音，用键盘敲出英文句子。",
  },
  paper: {
    label: "套卷",
    href: new URL("papers/try", ONLINE_CLIENT_URL).toString(),
    blurb: "一词多练：听音辨词、选义、填空等题型。",
  },
  tool: {
    label: "工具",
    href: new URL("tools/dictation", ONLINE_CLIENT_URL).toString(),
    blurb: "听写默写：像课堂听写一样听音写词。",
  },
};

const MODES: Mode[] = ["course", "paper", "tool"];

function IconKeyboard() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2" y="6" width="20" height="12" rx="2" stroke="currentColor" strokeWidth="2.2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function IconFile() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-6Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M14 2v6h6M9 13h6M9 17h4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function IconHeadphones() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 13a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M4 13v4a2 2 0 0 0 2 2h1v-6H6a2 2 0 0 0-2 2Zm16 0v4a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
  );
}

function IconVolume() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M11 5 6 9H3v6h3l5 4V5Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 6a9 9 0 0 1 0 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12.5 10 17.5 19 7.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ModeIcon({ mode }: { mode: Mode }) {
  if (mode === "course") return <IconKeyboard />;
  if (mode === "paper") return <IconFile />;
  return <IconHeadphones />;
}

/**
 * 首页产品演示：课程敲句 → 套卷听音选题 → 工具听写，轮流播放。
 */
export function ProductDemo() {
  const [mode, setMode] = useState<Mode>("course");
  const [hot, setHot] = useState<Mode | null>("course");
  const [manual, setManual] = useState(false);
  const [loopKey, setLoopKey] = useState(0);

  const [coursePhase, setCoursePhase] = useState<CoursePhase>("typing");
  const [typedLen, setTypedLen] = useState(0);
  const [paperPhase, setPaperPhase] = useState<PaperPhase>("prompt");
  const [picked, setPicked] = useState<number | null>(null);
  const [toolPhase, setToolPhase] = useState<ToolPhase>("listen");
  const [toolIndex, setToolIndex] = useState(0);
  const [waitSec, setWaitSec] = useState(3);

  useEffect(() => {
    if (manual) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setMode("course");
      setTypedLen(COURSE_TARGET.length);
      setCoursePhase("correct");
      return;
    }

    let cancelled = false;
    const timers: number[] = [];

    function schedule(fn: () => void, ms: number) {
      const id = window.setTimeout(() => {
        if (!cancelled) fn();
      }, ms);
      timers.push(id);
    }

    function flash(next: Mode) {
      setHot(next);
      schedule(() => setHot(null), 1400);
    }

    function runCourse(then?: () => void) {
      setMode("course");
      flash("course");
      setCoursePhase("typing");
      setTypedLen(0);
      for (let i = 1; i <= COURSE_TARGET.length; i++) {
        schedule(() => setTypedLen(i), i * 90);
      }
      const afterType = COURSE_TARGET.length * 90 + 420;
      schedule(() => setCoursePhase("correct"), afterType);
      schedule(() => setCoursePhase("next"), afterType + 800);
      schedule(() => then?.(), afterType + 2600);
    }

    function runPaper(then?: () => void) {
      setMode("paper");
      flash("paper");
      setPaperPhase("prompt");
      setPicked(null);
      schedule(() => {
        setPaperPhase("picked");
        setPicked(PAPER_ANSWER);
      }, 1200);
      schedule(() => setPaperPhase("correct"), 2000);
      schedule(() => then?.(), 4200);
    }

    function runTool(then?: () => void) {
      setMode("tool");
      flash("tool");
      setToolPhase("listen");
      setToolIndex(0);
      setWaitSec(3);
      schedule(() => {
        setToolPhase("wait");
        setWaitSec(3);
      }, 1600);
      schedule(() => setWaitSec(2), 2400);
      schedule(() => setWaitSec(1), 3200);
      schedule(() => {
        setToolIndex(1);
        setToolPhase("next");
      }, 4000);
      schedule(() => setToolPhase("listen"), 4500);
      schedule(() => setToolPhase("done"), 6200);
      schedule(() => then?.(), 9000);
    }

    const sequence = [runCourse, runPaper, runTool];
    let idx = 0;

    function loop() {
      const run = sequence[idx % sequence.length];
      idx += 1;
      run(() => schedule(loop, 0));
    }

    loop();
    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [manual, loopKey]);

  useEffect(() => {
    if (!manual) return;
    const hotTimer = window.setTimeout(() => setHot(null), 1200);
    const resumeTimer = window.setTimeout(() => {
      setManual(false);
      setLoopKey((k) => k + 1);
    }, 10000);
    return () => {
      window.clearTimeout(hotTimer);
      window.clearTimeout(resumeTimer);
    };
  }, [manual, mode]);

  function selectMode(next: Mode) {
    setManual(true);
    setMode(next);
    setHot(next);

    if (next === "course") {
      setCoursePhase("correct");
      setTypedLen(COURSE_TARGET.length);
    } else if (next === "paper") {
      setPaperPhase("correct");
      setPicked(PAPER_ANSWER);
    } else {
      setToolPhase("done");
      setToolIndex(1);
    }
  }

  const typed = COURSE_TARGET.slice(0, typedLen);
  const meta = MODE_META[mode];

  return (
    <div className="product-demo">
      <div className="product-demo-tabs" role="tablist" aria-label="功能演示">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            className={`product-demo-tab product-demo-tab-${m} ${
              mode === m ? "is-active" : ""
            } ${hot === m ? "is-hot" : ""}`}
            onClick={() => selectMode(m)}
          >
            <ModeIcon mode={m} />
            {MODE_META[m].label}
          </button>
        ))}
      </div>

      <div className="product-demo-stage-wrap">
        <div className={`product-demo-glow is-${mode}`} aria-hidden />
        <div className="product-demo-stage" aria-live="polite">
          {/* 课程 */}
          <article
            className={`product-demo-panel product-demo-course ${
              mode === "course" ? "is-visible" : "is-hidden"
            }`}
          >
            <header className="product-demo-head product-demo-head-course">
              <IconKeyboard />
              系列课程 · 键盘敲句
            </header>
            <div className="product-demo-body">
              <div className="product-demo-listen">
                <span
                  className={`product-demo-speaker ${
                    mode === "course" && coursePhase === "typing" ? "is-pulse" : ""
                  }`}
                >
                  <IconVolume />
                </span>
                <div>
                  <p className="product-demo-zh">我喜欢苹果</p>
                  <p className="product-demo-ipa">/aɪ laɪk ˈæplz/</p>
                </div>
              </div>
              <div className="product-demo-input">
                {typed}
                {mode === "course" && coursePhase === "typing" ? (
                  <span className="product-demo-caret" />
                ) : null}
              </div>
              <div className="product-demo-footer">
                {mode === "course" &&
                (coursePhase === "correct" || coursePhase === "next") ? (
                  <span className="product-demo-badge is-ok product-demo-pop">
                    <IconCheck />
                    答对了！
                  </span>
                ) : (
                  <span className="product-demo-hint">听音后敲出英文</span>
                )}
                {mode === "course" && coursePhase === "next" ? (
                  <span className="product-demo-next product-demo-pop">→ 下一题</span>
                ) : null}
              </div>
            </div>
          </article>

          {/* 套卷 */}
          <article
            className={`product-demo-panel product-demo-paper ${
              mode === "paper" ? "is-visible" : "is-hidden"
            }`}
          >
            <header className="product-demo-head product-demo-head-paper">
              <IconFile />
              套卷 · 听音辨词
            </header>
            <div className="product-demo-body">
              <div className="product-demo-paper-top">
                <span
                  className={`product-demo-speaker is-lg ${
                    mode === "paper" && paperPhase === "prompt" ? "is-pulse" : ""
                  }`}
                >
                  <IconVolume />
                </span>
                <p className="product-demo-prompt">{PAPER_PROMPT}</p>
              </div>
              <ul className="product-demo-options">
                {PAPER_OPTIONS.map((option, index) => {
                  const showCorrect =
                    mode === "paper" &&
                    paperPhase === "correct" &&
                    index === PAPER_ANSWER;
                  const isPicked =
                    mode === "paper" && picked === index && !showCorrect;
                  return (
                    <li
                      key={option}
                      className={
                        showCorrect ? "is-correct" : isPicked ? "is-picked" : ""
                      }
                    >
                      <span className="product-demo-opt-letter">
                        {String.fromCharCode(65 + index)}
                      </span>
                      {option}
                      {showCorrect ? " ✓" : ""}
                    </li>
                  );
                })}
              </ul>
              <div className="product-demo-footer">
                {mode === "paper" && paperPhase === "correct" ? (
                  <span className="product-demo-badge is-ok product-demo-pop">
                    <IconCheck />
                    答对了 · 下一题
                  </span>
                ) : (
                  <span className="product-demo-hint">听完选一个正确答案</span>
                )}
              </div>
            </div>
          </article>

          {/* 工具 */}
          <article
            className={`product-demo-panel product-demo-tool ${
              mode === "tool" ? "is-visible" : "is-hidden"
            }`}
          >
            <header className="product-demo-head product-demo-head-tool">
              <IconHeadphones />
              工具 · 听写默写
            </header>
            <div className="product-demo-body">
              {toolPhase !== "done" ? (
                <>
                  <p className="product-demo-tool-eyebrow">听写中</p>
                  <p className="product-demo-tool-count">
                    {toolIndex + 1}
                    <span> / {TOOL_WORDS.length}</span>
                  </p>
                  <p className="product-demo-tool-hint">
                    {toolPhase === "wait"
                      ? `间隔 ${waitSec} 秒…`
                      : "请听读音，在纸上默写…"}
                  </p>
                  <div
                    className={`product-demo-speaker is-xl ${
                      toolPhase === "listen" || toolPhase === "next"
                        ? "is-pulse"
                        : ""
                    }`}
                  >
                    <IconVolume />
                  </div>
                  <p className="product-demo-hint mt-3">
                    {toolPhase === "listen" || toolPhase === "next"
                      ? "播放中（第 1/2 遍）"
                      : "准备下一词"}
                  </p>
                  <div className="product-demo-progress">
                    <div
                      style={{
                        width: `${((toolIndex + 1) / TOOL_WORDS.length) * 100}%`,
                      }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <p className="product-demo-tool-eyebrow">听写结束</p>
                  <p className="product-demo-tool-done-title">对照答案</p>
                  <ul className="product-demo-answers">
                    {TOOL_WORDS.map((w, i) => (
                      <li
                        key={w}
                        className="product-demo-pop"
                        style={{ animationDelay: `${i * 0.08}s` }}
                      >
                        <span>{i + 1}</span>
                        <strong>{w}</strong>
                        <IconCheck />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </article>
        </div>
      </div>

      <div className="product-demo-caption">
        <p>
          <strong>{meta.label}</strong>
          <span> · {meta.blurb}</span>
        </p>
        <a
          href={meta.href}
          target="_blank"
          rel="noopener noreferrer"
          className={`product-demo-cta is-${mode}`}
        >
          去试试 →
        </a>
      </div>
    </div>
  );
}
