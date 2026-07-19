"use client";

import { useEffect, useRef, useState } from "react";

type Challenge = {
  a: number;
  b: number;
  op: "+" | "-";
  answer: number;
};

function makeChallenge(): Challenge {
  const op = Math.random() < 0.5 ? "+" : "-";
  if (op === "+") {
    const a = 1 + Math.floor(Math.random() * 9);
    const b = 1 + Math.floor(Math.random() * 9);
    return { a, b, op, answer: a + b };
  }
  const a = 2 + Math.floor(Math.random() * 9);
  const b = 1 + Math.floor(Math.random() * a);
  return { a, b, op, answer: a - b };
}

type Props = {
  onSolvedChange: (solved: boolean) => void;
};

export function MathCaptcha({ onSolvedChange }: Props) {
  const onSolvedChangeRef = useRef(onSolvedChange);
  onSolvedChangeRef.current = onSolvedChange;

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    setChallenge(makeChallenge());
    setValue("");
    onSolvedChangeRef.current(false);
  }, []);

  function refresh() {
    setChallenge(makeChallenge());
    setValue("");
    onSolvedChangeRef.current(false);
  }

  function handleChange(next: string) {
    const cleaned = next.replace(/[^\d-]/g, "");
    setValue(cleaned);
    if (!challenge || cleaned === "") {
      onSolvedChangeRef.current(false);
      return;
    }
    onSolvedChangeRef.current(Number(cleaned) === challenge.answer);
  }

  if (!challenge) {
    return (
      <div>
        <p className="mb-2 text-sm font-medium text-ink/80">验证码</p>
        <p className="text-sm text-muted">生成题目中…</p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-ink/80">验证码</p>
      <div className="flex items-center gap-3">
        <span className="shrink-0 font-[family-name:var(--font-display)] text-lg font-semibold tracking-wide text-ink">
          {challenge.a} {challenge.op} {challenge.b} =
        </span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="?"
          aria-label={`请计算 ${challenge.a} ${challenge.op} ${challenge.b}`}
          className="w-24 rounded-2xl border border-line/10 bg-[#f7fbfe] px-3 py-2.5 text-center text-[15px] text-ink outline-none transition placeholder:text-muted/60 focus:border-accent focus:bg-white focus:shadow-[0_0_0_4px_var(--glow)]"
        />
        <button
          type="button"
          onClick={refresh}
          className="shrink-0 rounded-full border border-line/10 px-3 py-2 text-sm text-muted transition hover:border-accent hover:text-accent-deep"
        >
          换一题
        </button>
      </div>
    </div>
  );
}
