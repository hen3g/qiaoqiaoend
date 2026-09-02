"use client";

import { type ReactNode } from "react";
import { Button, Form, Input, Space, Tag, Typography } from "@arco-design/web-react";
import {
  QUESTION_TYPE_LABELS,
  WORD_ONLY_QUESTION_ID,
  isPaperQuestionType,
  type DragVariantDto,
  type PaperQuestionDto,
  type PaperQuestionType,
  type WordFieldPatch,
} from "@/lib/paper-question";

export type VisiblePatchFields = {
  prompt: boolean;
  answer: boolean;
  translation: boolean;
  audioText: boolean;
  targetForm: boolean;
  options: boolean;
  hints: boolean;
  variants: boolean;
  phonetic: boolean;
  meaning: boolean;
  partOfSpeech: boolean;
  example: boolean;
  wordTranslation: boolean;
};

export type PatchFormValue = {
  kind: "question" | "word";
  word: string;
  questionId: string;
  type: PaperQuestionType;
  prompt: string;
  answer: string;
  translation: string;
  audioText: string;
  targetForm: string;
  optionsText: string;
  hintsText: string;
  variantSource: string;
  variantAnswerText: string;
  variantDistractorText: string;
  phonetic: string;
  meaning: string;
  partOfSpeech: string;
  example: string;
  wordTranslation: string;
  note: string;
  comment: string;
  visible: VisiblePatchFields;
};

export type PatchSubmitPayload = {
  word: string;
  questionId: string;
  question: PaperQuestionDto | null;
  wordFields: WordFieldPatch | null;
  note: string;
};

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasList(value: unknown): boolean {
  return Array.isArray(value) && value.some((item) => hasText(item));
}

function linesToList(value: string): string[] | undefined {
  const items = value
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function listToLines(value: string[] | undefined): string {
  return value?.join("\n") ?? "";
}

function firstVariant(question?: PaperQuestionDto | null): DragVariantDto | null {
  return question?.variants?.[0] ?? null;
}

function visibleFromSource(input: {
  question?: PaperQuestionDto | null;
  phonetic?: string;
  meaning?: string;
  partOfSpeech?: string;
  example?: string;
  translation?: string;
  wordFields?: WordFieldPatch | null;
}): VisiblePatchFields {
  const question = input.question;
  const wordOnly = !question;
  return {
    prompt: hasText(question?.prompt),
    answer: hasText(question?.answer),
    translation: hasText(question?.translation),
    audioText: hasText(question?.audioText),
    targetForm: hasText(question?.targetForm),
    options: hasList(question?.options),
    hints: hasList(question?.hints),
    variants: Boolean(question?.variants?.length),
    phonetic: hasText(input.wordFields?.phonetic || input.phonetic),
    meaning: hasText(input.wordFields?.meaning || input.meaning) || wordOnly,
    partOfSpeech: hasText(input.wordFields?.partOfSpeech || input.partOfSpeech),
    example: hasText(input.wordFields?.example || input.example),
    wordTranslation: hasText(
      input.wordFields?.translation || input.translation,
    ),
  };
}

export function formFromQuestion(input: {
  word: string;
  questionId?: string;
  question?: PaperQuestionDto | null;
  wordFields?: WordFieldPatch | null;
  phonetic?: string;
  meaning?: string;
  partOfSpeech?: string;
  example?: string;
  translation?: string;
  note?: string;
  comment?: string;
}): PatchFormValue {
  const question = input.question;
  const variant = firstVariant(question);
  const wordOnly = !question && !input.questionId;
  return {
    kind: wordOnly ? "word" : "question",
    word: input.word,
    questionId: input.questionId || question?.id || "",
    type:
      question && isPaperQuestionType(question.type) ? question.type : "zh_to_en",
    prompt: question?.prompt ?? "",
    answer: question?.answer ?? "",
    translation: question?.translation ?? "",
    audioText: question?.audioText ?? "",
    targetForm: question?.targetForm ?? "",
    optionsText: listToLines(question?.options),
    hintsText: listToLines(question?.hints),
    variantSource: variant?.source ?? "",
    variantAnswerText: listToLines(variant?.answerTokens),
    variantDistractorText: listToLines(variant?.distractorTokens),
    phonetic: input.wordFields?.phonetic || input.phonetic || "",
    meaning: input.wordFields?.meaning || input.meaning || "",
    partOfSpeech: input.wordFields?.partOfSpeech || input.partOfSpeech || "",
    example: input.wordFields?.example || input.example || "",
    wordTranslation: input.wordFields?.translation || input.translation || "",
    note: input.note || "",
    comment: input.comment || "",
    visible: visibleFromSource(input),
  };
}

export function payloadFromForm(
  form: PatchFormValue,
): { ok: true; payload: PatchSubmitPayload } | { ok: false; error: string } {
  const word = form.word.trim();
  if (!word) return { ok: false, error: "缺少单词" };

  const wordFields: WordFieldPatch = {};
  if (form.visible.phonetic && form.phonetic.trim()) {
    wordFields.phonetic = form.phonetic.trim();
  }
  if (form.visible.meaning && form.meaning.trim()) {
    wordFields.meaning = form.meaning.trim();
  }
  if (form.visible.partOfSpeech && form.partOfSpeech.trim()) {
    wordFields.partOfSpeech = form.partOfSpeech.trim();
  }
  if (form.visible.example && form.example.trim()) {
    wordFields.example = form.example.trim();
  }
  if (form.visible.wordTranslation && form.wordTranslation.trim()) {
    wordFields.translation = form.wordTranslation.trim();
  }
  const hasWordFields = Object.keys(wordFields).length > 0;

  if (form.kind === "word") {
    if (!hasWordFields) return { ok: false, error: "请至少修改一处词条内容" };
    return {
      ok: true,
      payload: {
        word,
        questionId: WORD_ONLY_QUESTION_ID,
        question: null,
        wordFields,
        note: form.note.trim() || form.comment.trim(),
      },
    };
  }

  const questionId = form.questionId.trim();
  if (!questionId) return { ok: false, error: "这道报告缺少题号，无法发补丁" };
  if (form.visible.prompt && !form.prompt.trim()) {
    return { ok: false, error: "题目不能为空" };
  }
  if (form.visible.answer && !form.answer.trim()) {
    return { ok: false, error: "答案不能为空" };
  }

  let variants: PaperQuestionDto["variants"];
  if (form.visible.variants) {
    const answerTokens = linesToList(form.variantAnswerText);
    if (!form.variantSource.trim() || !answerTokens) {
      return { ok: false, error: "拖拽题需要原句和答案词块" };
    }
    variants = [
      {
        direction: "zh_to_en",
        source: form.variantSource.trim(),
        answerTokens,
        distractorTokens: linesToList(form.variantDistractorText) ?? [],
      },
    ];
  }

  const question: PaperQuestionDto = {
    id: questionId,
    type: form.type,
    prompt: form.prompt.trim() || word,
    answer: form.answer.trim() || word,
  };
  if (form.visible.translation && form.translation.trim()) {
    question.translation = form.translation.trim();
  }
  if (form.visible.audioText && form.audioText.trim()) {
    question.audioText = form.audioText.trim();
  }
  if (form.visible.targetForm && form.targetForm.trim()) {
    question.targetForm = form.targetForm.trim();
  }
  if (form.visible.options) {
    const options = linesToList(form.optionsText);
    if (options) question.options = options;
  }
  if (form.visible.hints) {
    const hints = linesToList(form.hintsText);
    if (hints) question.hints = hints;
  }
  if (variants) question.variants = variants;

  return {
    ok: true,
    payload: {
      word,
      questionId,
      question,
      wordFields: hasWordFields ? wordFields : null,
      note: form.note.trim() || form.comment.trim(),
    },
  };
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return <Form.Item label={label}>{children}</Form.Item>;
}

export function QuestionPatchForm({
  value,
  onChange,
  onSubmit,
  submitText,
  submitting,
}: {
  value: PatchFormValue;
  onChange: (next: PatchFormValue) => void;
  onSubmit: () => void;
  submitText: string;
  submitting: boolean;
}) {
  const patch = <K extends keyof PatchFormValue>(key: K, next: PatchFormValue[K]) => {
    onChange({ ...value, [key]: next });
  };
  const { visible } = value;
  const typeLabel = isPaperQuestionType(value.type)
    ? QUESTION_TYPE_LABELS[value.type]
    : value.kind === "word"
      ? "学习单词"
      : value.type;

  return (
    <Form layout="vertical" onSubmit={onSubmit}>
      <Space wrap style={{ marginBottom: 12 }}>
        <Typography.Text bold style={{ fontSize: 18 }}>
          {value.word}
        </Typography.Text>
        <Tag>{typeLabel}</Tag>
      </Space>
      {value.comment ? (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 12px",
            borderRadius: 8,
            background: "var(--color-fill-2)",
            whiteSpace: "pre-wrap",
          }}
        >
          <Typography.Text type="secondary">用户反馈：</Typography.Text>
          {value.comment}
        </div>
      ) : null}

      {visible.meaning ? (
        <Field label="释义">
          <Input
            value={value.meaning}
            onChange={(meaning) => patch("meaning", meaning)}
            maxLength={512}
          />
        </Field>
      ) : null}
      {visible.phonetic ? (
        <Field label="音标">
          <Input
            value={value.phonetic}
            onChange={(phonetic) => patch("phonetic", phonetic)}
            maxLength={128}
          />
        </Field>
      ) : null}
      {visible.partOfSpeech ? (
        <Field label="词性">
          <Input
            value={value.partOfSpeech}
            onChange={(partOfSpeech) => patch("partOfSpeech", partOfSpeech)}
            maxLength={64}
          />
        </Field>
      ) : null}
      {visible.example ? (
        <Field label="例句">
          <Input.TextArea
            value={value.example}
            onChange={(example) => patch("example", example)}
            autoSize={{ minRows: 2, maxRows: 4 }}
            maxLength={2000}
          />
        </Field>
      ) : null}
      {visible.wordTranslation ? (
        <Field label="例句译文">
          <Input.TextArea
            value={value.wordTranslation}
            onChange={(wordTranslation) => patch("wordTranslation", wordTranslation)}
            autoSize={{ minRows: 2, maxRows: 4 }}
            maxLength={2000}
          />
        </Field>
      ) : null}

      {visible.prompt ? (
        <Field label="题目">
          <Input.TextArea
            value={value.prompt}
            onChange={(prompt) => patch("prompt", prompt)}
            autoSize={{ minRows: 2, maxRows: 6 }}
            maxLength={2000}
          />
        </Field>
      ) : null}
      {visible.answer ? (
        <Field label="答案">
          <Input.TextArea
            value={value.answer}
            onChange={(answer) => patch("answer", answer)}
            autoSize={{ minRows: 2, maxRows: 4 }}
            maxLength={2000}
          />
        </Field>
      ) : null}
      {visible.translation ? (
        <Field label="译文">
          <Input.TextArea
            value={value.translation}
            onChange={(translation) => patch("translation", translation)}
            autoSize={{ minRows: 2, maxRows: 4 }}
            maxLength={2000}
          />
        </Field>
      ) : null}
      {visible.audioText ? (
        <Field label="音频文本">
          <Input
            value={value.audioText}
            onChange={(audioText) => patch("audioText", audioText)}
            maxLength={2000}
          />
        </Field>
      ) : null}
      {visible.targetForm ? (
        <Field label="句中目标词">
          <Input
            value={value.targetForm}
            onChange={(targetForm) => patch("targetForm", targetForm)}
            maxLength={200}
          />
        </Field>
      ) : null}
      {visible.options ? (
        <Field label="选项（每行一项）">
          <Input.TextArea
            value={value.optionsText}
            onChange={(optionsText) => patch("optionsText", optionsText)}
            autoSize={{ minRows: 4, maxRows: 12 }}
          />
        </Field>
      ) : null}
      {visible.hints ? (
        <Field label="提示（每行一项）">
          <Input.TextArea
            value={value.hintsText}
            onChange={(hintsText) => patch("hintsText", hintsText)}
            autoSize={{ minRows: 2, maxRows: 6 }}
          />
        </Field>
      ) : null}
      {visible.variants ? (
        <>
          <Field label="拖拽原句">
            <Input.TextArea
              value={value.variantSource}
              onChange={(variantSource) => patch("variantSource", variantSource)}
              autoSize={{ minRows: 2, maxRows: 4 }}
              maxLength={2000}
            />
          </Field>
          <Field label="答案词块（每行一个）">
            <Input.TextArea
              value={value.variantAnswerText}
              onChange={(variantAnswerText) =>
                patch("variantAnswerText", variantAnswerText)
              }
              autoSize={{ minRows: 3, maxRows: 10 }}
            />
          </Field>
          <Field label="干扰词块（每行一个）">
            <Input.TextArea
              value={value.variantDistractorText}
              onChange={(variantDistractorText) =>
                patch("variantDistractorText", variantDistractorText)
              }
              autoSize={{ minRows: 3, maxRows: 10 }}
            />
          </Field>
        </>
      ) : null}

      <Button type="primary" htmlType="submit" loading={submitting}>
        {submitText}
      </Button>
    </Form>
  );
}
