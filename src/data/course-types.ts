/** 课程包数据结构 */

import type { PracticeMode } from "@/data/practice-modes";

export type { PracticeMode };

export type CourseWord = {
  id: string;
  en: string;
  zh: string;
  ipa: string;
};

/** 词性（中文标签，便于启蒙预习展示） */
export type TokenPos =
  | "感叹词"
  | "代词"
  | "动词"
  | "系动词"
  | "助动词"
  | "名词"
  | "形容词"
  | "副词"
  | "冠词"
  | "限定词"
  | "介词"
  | "连词"
  | "数词"
  | "疑问词";

/**
 * 句法角色（主谓宾定状补 + 预习辅助项）
 * - subject 主语 / predicate 谓语 / object 宾语
 * - attributive 定语 / adverbial 状语 / complement 补语
 */
export type TokenRole =
  | "word" // 单词级条目
  | "subject" // 主语
  | "predicate" // 谓语
  | "object" // 宾语
  | "attributive" // 定语（如 a / my / happy）
  | "adverbial" // 状语
  | "complement" // 补语（如 is happy 的 happy）
  | "vocative" // 称呼语（Hello mom 的 mom）
  | "head"; // 短语中心语（my book 的 book）

export type CourseSentenceToken = {
  en: string;
  /** 简短中文释义 */
  zh: string;
  /** 更详细的中文讲解（用法/语境） */
  zhDetail: string;
  ipa: string;
  pos: TokenPos;
  role: TokenRole;
};

export type CourseSentence = {
  id: string;
  /** 英文原句；练习时字母与空格需敲入，标点自动显示 */
  en: string;
  /** 中文提示，显示在上方（不含说话人前缀） */
  zh: string;
  /** 整句音标 */
  ipa: string;
  /** 难度：word → phrase → sentence */
  level: "word" | "phrase" | "sentence";
  /**
   * 情景对话说话人，如 A / B / C。
   * 只用于展示，不要求用户敲入；正文不要再写「A: …」。
   */
  speaker?: string;
  /** 词级拆解；单词 1 项，短语/句子按词拆开。缺省时旧课仍可用。 */
  tokens?: CourseSentenceToken[];
};

export type CourseLesson = {
  id: string;
  title: string;
  words: CourseWord[];
  sentences: CourseSentence[];
};

/** 难度星级：1 最简单 → 5 最难 */
export type CourseDifficulty = 1 | 2 | 3 | 4 | 5;

export type CourseSeries = {
  id: string;
  title: string;
  description: string;
  difficulty: CourseDifficulty;
  /** 同星级内的系列顺序（1 起） */
  order: number;
  /** 该系列目标课程数，当前内置体系固定为 10 */
  courseCountTarget: number;
};

export type CoursePack = {
  id: string;
  /** 所属系列。内置课程必须填写；自制/外部课可选。 */
  seriesId?: string;
  /** 当前系列内课程顺序（1 起）。 */
  seriesOrder?: number;
  title: string;
  description: string;
  difficulty: CourseDifficulty;
  /** 预计完成时长（分钟） */
  durationMinutes: number;
  /**
   * 闯关位置（可选）。有该字段的课会出现在成长树上。
   * 建议稀疏编号（×100：100/200/300…），便于中间插入。
   * - "100" 第一关；"200" 须通关前一主干
   * - "200.1" / "200.2" 为 200 的侧枝（不挡下一主干）
   * 接受数字或字符串，内部规范成点分段形式。
   */
  stage?: string | number;
  /**
   * 练习模式（自制课）：
   * progressive = 单词→短语→句子；
   * sentences = 全造句；
   * dialogue = 情景对话；
   * article = 由粘贴文章生成（全部 sentence）。
   * 缺省视为 progressive。
   */
  practiceMode?: PracticeMode;
  /**
   * 读音是否已就绪。false/缺省且自制课 → 预览态，不可直接练习。
   * 读音 SSE 完成后置为 true。
   */
  audioReady?: boolean;
  /** 原作者用户 id；缺省或等于当前用户 = 自己制作 */
  authorUserId?: number;
  /** 原作者展示名（昵称或用户名） */
  authorName?: string;
  /** 原作者头像 URL */
  authorAvatarUrl?: string | null;
  /**
   * 来源键：`${ownerUserId}:${originalCourseId}`。
   * 广场添加只写库里的指针，所有用户共用作者那一份 JSON。
   */
  sourceCourseKey?: string;
  lessons: CourseLesson[];
};

export type CoursePackSummary = {
  id: string;
  seriesId?: string;
  seriesOrder?: number;
  title: string;
  description: string;
  difficulty: CourseDifficulty;
  durationMinutes: number;
  wordCount: number;
  exerciseCount: number;
  lessonCount: number;
  /** 闯关 stage，有则参与成长树 */
  stage?: string;
  /** 自制课练习模式；内置课通常缺省 */
  practiceMode?: PracticeMode;
  /** 用户通过网页 / AI 生成并保存在 R2 的课程 */
  isUserCreated?: boolean;
  /** false = 预览态（读音未完成） */
  audioReady?: boolean;
  authorUserId?: number;
  authorName?: string;
  authorAvatarUrl?: string | null;
  sourceCourseKey?: string;
};

/** 我的课程分组 */
export type UserCourseGroup = {
  id: number;
  name: string;
  sortOrder: number;
  courseCount?: number;
};

/** 我的课程列表条目（自制 + 广场添加） */
export type MyCourseSummary = CoursePackSummary & {
  /** 用户备注 */
  note?: string;
  groupId?: number | null;
  groupName?: string | null;
  /** true = 从课程广场添加的引用（共用原课 JSON） */
  fromPlaza: boolean;
  updatedAt?: string;
};

/** 课程广场条目 */
export type PlazaCourseSummary = CoursePackSummary & {
  ownerUserId: number;
  /** 当前登录用户是否已添加过该课 */
  alreadyAdded?: boolean;
  /** 当前用户库中可练习的课程 id（自己的课或已添加的副本） */
  myCourseId?: string;
};
