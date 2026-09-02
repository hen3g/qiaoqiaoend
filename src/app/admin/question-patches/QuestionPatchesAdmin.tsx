"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Empty,
  Message,
  Modal,
  Space,
  Tag,
  Typography,
} from "@arco-design/web-react";
import {
  QUESTION_TYPE_LABELS,
  WORD_ONLY_QUESTION_ID,
  isPaperQuestionType,
  type PaperQuestionDto,
  type WordFieldPatch,
} from "@/lib/paper-question";
import {
  QuestionPatchForm,
  formFromQuestion,
  payloadFromForm,
  type PatchFormValue,
} from "@/components/admin/QuestionPatchForm";

type QuestionPatchDto = {
  id: number;
  word: string;
  questionId: string;
  question: PaperQuestionDto | null;
  wordFields: WordFieldPatch | null;
  note: string;
  createdAt: string | null;
  updatedAt: string | null;
};

function formatTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("zh-CN", { hour12: false });
}

function typeLabel(question: PaperQuestionDto | null, questionId: string): string {
  if (questionId === WORD_ONLY_QUESTION_ID || !question) return "词条";
  if (isPaperQuestionType(question.type)) return QUESTION_TYPE_LABELS[question.type];
  return question.type;
}

export function QuestionPatchesAdmin() {
  const [patches, setPatches] = useState<QuestionPatchDto[]>([]);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<QuestionPatchDto | null>(null);
  const [form, setForm] = useState<PatchFormValue | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadPatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/question-patches");
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "加载失败");
        return;
      }
      setPatches((data.patches ?? []) as QuestionPatchDto[]);
      setVersion(Number(data.version ?? 0));
      setError("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPatches();
  }, [loadPatches]);

  const editPatch = (patch: QuestionPatchDto) => {
    setEditing(patch);
    setForm(
      formFromQuestion({
        word: patch.word,
        questionId:
          patch.questionId === WORD_ONLY_QUESTION_ID ? "" : patch.questionId,
        question: patch.question,
        wordFields: patch.wordFields,
        note: patch.note,
        comment: patch.note,
      }),
    );
  };

  const savePatch = async () => {
    if (!form) return;
    const parsed = payloadFromForm(form);
    if (!parsed.ok) {
      Message.warning(parsed.error);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/question-patches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        Message.error(data.error || "保存失败");
        return;
      }
      Message.success(data.message || "已保存");
      setVersion(Number(data.version ?? version));
      setEditing(null);
      setForm(null);
      await loadPatches();
    } finally {
      setSaving(false);
    }
  };

  const deletePatch = (patch: QuestionPatchDto) => {
    Modal.confirm({
      title: "删除补丁？",
      content: `删除后，App 下次同步会去掉对「${patch.word}」的这处替换。`,
      okButtonProps: { status: "danger" },
      onOk: async () => {
        setDeletingId(patch.id);
        try {
          const res = await fetch("/api/admin/question-patches", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: patch.id }),
          });
          const data = await res.json();
          if (!res.ok || !data.ok) {
            Message.error(data.error || "删除失败");
            return;
          }
          Message.success(data.message || "已删除");
          if (editing?.id === patch.id) {
            setEditing(null);
            setForm(null);
          }
          setVersion(Number(data.version ?? version));
          await loadPatches();
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Card
        title="已发布补丁"
        extra={
          <Button onClick={() => void loadPatches()} loading={loading}>
            刷新
          </Button>
        }
      >
        <Typography.Paragraph type="secondary">
          当前版本 {version} · 共 {patches.length} 条。补丁从「题目报告」里根据用户提交的题目
          JSON 生成，这里只查看、修改和删除。
        </Typography.Paragraph>
        {error ? <Alert type="error" content={error} /> : null}
        {!loading && patches.length === 0 ? (
          <Empty description="还没有补丁，请到题目报告里点「发布补丁」" />
        ) : (
          <Space direction="vertical" size="medium" style={{ width: "100%" }}>
            {patches.map((item) => (
              <Card key={item.id} size="small">
                <Space
                  style={{ width: "100%", justifyContent: "space-between" }}
                  wrap
                >
                  <Space wrap>
                    <Tag>{typeLabel(item.question, item.questionId)}</Tag>
                    <Typography.Text bold>{item.word}</Typography.Text>
                    {item.questionId !== WORD_ONLY_QUESTION_ID ? (
                      <Typography.Text type="secondary">
                        {item.questionId}
                      </Typography.Text>
                    ) : null}
                  </Space>
                  <Typography.Text type="secondary">
                    {formatTime(item.updatedAt)}
                  </Typography.Text>
                </Space>
                {item.question?.prompt ? (
                  <Typography.Paragraph style={{ marginTop: 8, marginBottom: 4 }}>
                    <Typography.Text type="secondary">题目：</Typography.Text>
                    {item.question.prompt}
                  </Typography.Paragraph>
                ) : null}
                {item.question?.answer ? (
                  <Typography.Paragraph style={{ marginBottom: 4 }}>
                    <Typography.Text type="secondary">答案：</Typography.Text>
                    {item.question.answer}
                  </Typography.Paragraph>
                ) : null}
                {item.wordFields?.meaning ? (
                  <Typography.Paragraph style={{ marginBottom: 4 }}>
                    <Typography.Text type="secondary">释义：</Typography.Text>
                    {item.wordFields.meaning}
                  </Typography.Paragraph>
                ) : null}
                {item.note ? (
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                    备注：{item.note}
                  </Typography.Paragraph>
                ) : null}
                <Space>
                  <Button size="small" onClick={() => editPatch(item)}>
                    修改
                  </Button>
                  <Button
                    size="small"
                    status="danger"
                    loading={deletingId === item.id}
                    onClick={() => deletePatch(item)}
                  >
                    删除
                  </Button>
                </Space>
              </Card>
            ))}
          </Space>
        )}
      </Card>

      <Modal
        title={editing ? `修改补丁 · ${editing.word}` : "修改补丁"}
        visible={Boolean(editing && form)}
        onCancel={() => {
          if (saving) return;
          setEditing(null);
          setForm(null);
        }}
        footer={null}
        style={{ width: 640 }}
        unmountOnExit
      >
        {form ? (
          <QuestionPatchForm
            value={form}
            onChange={setForm}
            onSubmit={() => void savePatch()}
            submitText="保存补丁"
            submitting={saving}
          />
        ) : null}
      </Modal>
    </Space>
  );
}
