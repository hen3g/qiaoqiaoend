"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Empty,
  Message,
  Modal,
  Radio,
  Space,
  Tag,
  Typography,
} from "@arco-design/web-react";
import {
  isPaperQuestionType,
  type PaperQuestionDto,
} from "@/lib/paper-question";
import {
  QuestionPatchForm,
  formFromQuestion,
  payloadFromForm,
  type PatchFormValue,
} from "@/components/admin/QuestionPatchForm";

type QuestionReportStatus = "pending" | "handled";

type QuestionReportDto = {
  id: number;
  userId: number;
  username: string | null;
  nickname: string | null;
  courseId: string;
  paperId: string;
  word: string;
  phonetic: string;
  meaning: string;
  partOfSpeech: string;
  example: string;
  questionId: string;
  questionType: string;
  prompt: string;
  answer: string;
  translation: string;
  audioText: string;
  options: string[];
  question: PaperQuestionDto | null;
  comment: string;
  status: QuestionReportStatus;
  createdAt: string | null;
  handledAt: string | null;
};

const QUESTION_TYPE_LABEL: Record<string, string> = {
  zh_to_en: "看中写英",
  listening: "听音辨词",
  listening_spell: "听音拼写",
  choice: "释义选择",
  en_to_zh_choice: "句中选义",
  sentence_translation: "听句选译",
  sentence_cloze: "句中填空",
  drag: "拖拽组句",
  learn: "学习单词",
};

function formatTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("zh-CN", { hour12: false });
}

function typeLabel(type: string): string {
  return QUESTION_TYPE_LABEL[type] || type || "题目";
}

function questionFromReport(item: QuestionReportDto): PaperQuestionDto | null {
  if (item.question) return item.question;
  if (!item.questionId || item.questionType === "learn") return null;
  if (!isPaperQuestionType(item.questionType)) return null;
  const question: PaperQuestionDto = {
    id: item.questionId,
    type: item.questionType,
    prompt: item.prompt || item.meaning || item.word,
    answer: item.answer || item.word,
  };
  if (item.translation) question.translation = item.translation;
  if (item.audioText) question.audioText = item.audioText;
  if (item.options.length > 0) question.options = item.options;
  return question;
}

export function QuestionReportsAdmin() {
  const [statusFilter, setStatusFilter] = useState<"all" | QuestionReportStatus>(
    "pending",
  );
  const [reports, setReports] = useState<QuestionReportDto[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [patchReport, setPatchReport] = useState<QuestionReportDto | null>(null);
  const [patchForm, setPatchForm] = useState<PatchFormValue | null>(null);
  const [savingPatch, setSavingPatch] = useState(false);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/question-reports");
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "加载失败");
        return;
      }
      setReports((data.reports ?? []) as QuestionReportDto[]);
      setError("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const onUpdate = async (id: number, action: "handle" | "reopen") => {
    setUpdatingId(id);
    try {
      const res = await fetch("/api/admin/question-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        Message.error(data.error || "操作失败");
        return;
      }
      const updated = data.report as QuestionReportDto;
      setReports((prev) =>
        prev.map((item) => (item.id === id ? updated : item)),
      );
      Message.success(data.message || "已更新");
    } finally {
      setUpdatingId(null);
    }
  };

  const openPatch = (item: QuestionReportDto) => {
    setPatchReport(item);
    setPatchForm(
      formFromQuestion({
        word: item.word,
        questionId: item.questionId,
        question: questionFromReport(item),
        phonetic: item.phonetic,
        meaning: item.meaning,
        partOfSpeech: item.partOfSpeech,
        example: item.example,
        translation: item.translation,
        comment: item.comment,
      }),
    );
  };

  const savePatchFromReport = async () => {
    if (!patchForm || !patchReport) return;
    const parsed = payloadFromForm(patchForm);
    if (!parsed.ok) {
      Message.warning(parsed.error);
      return;
    }
    setSavingPatch(true);
    try {
      const res = await fetch("/api/admin/question-patches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        Message.error(data.error || "发布补丁失败");
        return;
      }
      Message.success(data.message || "已发布补丁");
      if (patchReport.status !== "handled") {
        await onUpdate(patchReport.id, "handle");
      }
      setPatchReport(null);
      setPatchForm(null);
    } finally {
      setSavingPatch(false);
    }
  };

  const visible = useMemo(() => {
    return reports.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      return true;
    });
  }, [reports, statusFilter]);

  const pendingCount = reports.filter((item) => item.status === "pending").length;

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Card
        title="题目报告"
        extra={
          <Button onClick={() => void loadReports()} loading={loading}>
            刷新
          </Button>
        }
      >
        <Typography.Paragraph type="secondary">
          仓鼠单词 · 共 {reports.length} 条 · 待处理 {pendingCount} 条
          {statusFilter === "all" ? "" : ` · 当前显示 ${visible.length} 条`}
          · 点「发布补丁」会用用户提交的题目 JSON 生成可改字段，改完直接发布
        </Typography.Paragraph>
        <Radio.Group
          type="button"
          value={statusFilter}
          onChange={(value) =>
            setStatusFilter(value as "all" | QuestionReportStatus)
          }
        >
          <Radio value="pending">待处理</Radio>
          <Radio value="handled">已处理</Radio>
          <Radio value="all">全部状态</Radio>
        </Radio.Group>
      </Card>

      {error ? <Alert type="error" content={error} /> : null}

      {!loading && visible.length === 0 ? (
        <Empty description="还没有题目报告" />
      ) : (
        <Space direction="vertical" size="medium" style={{ width: "100%" }}>
          {visible.map((item) => {
            const displayName =
              item.nickname?.trim() || item.username || `用户#${item.userId}`;
            const handled = item.status === "handled";
            return (
              <Card key={item.id} size="small">
                <Space
                  style={{ width: "100%", justifyContent: "space-between" }}
                  wrap
                >
                  <Space wrap>
                    {handled ? (
                      <Tag color="green">已处理</Tag>
                    ) : (
                      <Tag color="orangered">待处理</Tag>
                    )}
                    <Tag>{typeLabel(item.questionType)}</Tag>
                    <Typography.Text bold>{displayName}</Typography.Text>
                    {item.username ? (
                      <Typography.Text type="secondary">
                        @{item.username}
                      </Typography.Text>
                    ) : null}
                  </Space>
                  <Typography.Text type="secondary">
                    {formatTime(item.createdAt)}
                  </Typography.Text>
                </Space>

                <Typography.Paragraph
                  style={{ marginTop: 12, marginBottom: 4 }}
                >
                  <Typography.Text bold style={{ fontSize: 18 }}>
                    {item.word}
                  </Typography.Text>
                  {item.phonetic ? (
                    <Typography.Text type="secondary">
                      {"  "}
                      {item.phonetic}
                    </Typography.Text>
                  ) : null}
                </Typography.Paragraph>
                {item.meaning ? (
                  <Typography.Paragraph style={{ marginBottom: 8 }}>
                    {item.partOfSpeech ? `${item.partOfSpeech} · ` : ""}
                    {item.meaning}
                  </Typography.Paragraph>
                ) : null}

                {item.prompt ? (
                  <Typography.Paragraph style={{ marginBottom: 8 }}>
                    <Typography.Text type="secondary">题目：</Typography.Text>
                    {item.prompt}
                  </Typography.Paragraph>
                ) : null}
                {item.answer ? (
                  <Typography.Paragraph style={{ marginBottom: 8 }}>
                    <Typography.Text type="secondary">答案：</Typography.Text>
                    {item.answer}
                  </Typography.Paragraph>
                ) : null}
                {item.translation ? (
                  <Typography.Paragraph style={{ marginBottom: 8 }}>
                    <Typography.Text type="secondary">译文：</Typography.Text>
                    {item.translation}
                  </Typography.Paragraph>
                ) : null}
                {item.options.length > 0 ? (
                  <Typography.Paragraph style={{ marginBottom: 8 }}>
                    <Typography.Text type="secondary">选项：</Typography.Text>
                    {item.options.join(" / ")}
                  </Typography.Paragraph>
                ) : null}
                {item.courseId || item.paperId ? (
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                    {item.courseId ? `课程 ${item.courseId}` : ""}
                    {item.courseId && item.paperId ? " · " : ""}
                    {item.paperId ? `套卷 ${item.paperId}` : ""}
                    {item.questionId ? ` · 题号 ${item.questionId}` : ""}
                  </Typography.Paragraph>
                ) : null}

                <div
                  style={{
                    marginTop: 4,
                    marginBottom: 12,
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: "var(--color-fill-2)",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  <Typography.Text type="secondary">用户说明：</Typography.Text>
                  {item.comment}
                </div>

                {handled && item.handledAt ? (
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                    处理于 {formatTime(item.handledAt)}
                  </Typography.Paragraph>
                ) : null}

                <div style={{ textAlign: "right" }}>
                  <Space>
                    <Button type="primary" onClick={() => openPatch(item)}>
                      发布补丁
                    </Button>
                    <Button
                      loading={updatingId === item.id}
                      onClick={() =>
                        void onUpdate(item.id, handled ? "reopen" : "handle")
                      }
                    >
                      {handled ? "重新打开" : "标记已处理"}
                    </Button>
                  </Space>
                </div>
              </Card>
            );
          })}
        </Space>
      )}

      <Modal
        title={patchReport ? `发布补丁 · ${patchReport.word}` : "发布补丁"}
        visible={Boolean(patchReport && patchForm)}
        onCancel={() => {
          if (savingPatch) return;
          setPatchReport(null);
          setPatchForm(null);
        }}
        footer={null}
        style={{ width: 640 }}
        unmountOnExit
      >
        {patchForm ? (
          <QuestionPatchForm
            value={patchForm}
            onChange={setPatchForm}
            onSubmit={() => void savePatchFromReport()}
            submitText="发布补丁"
            submitting={savingPatch}
          />
        ) : null}
      </Modal>
    </Space>
  );
}
