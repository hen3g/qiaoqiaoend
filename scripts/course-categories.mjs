/**
 * Course category taxonomy derived from pack title prefixes.
 * Keep in sync with scripts/sync-courses.mjs
 */

/** @typedef {{
 *   slug: string;
 *   title: string;
 *   subtitle: string;
 *   description: string;
 *   accent: string;
 *   tint: string;
 *   sortOrder: number;
 *   prefixes: string[];
 * }} CategoryDef
 */

/** @type {CategoryDef[]} */
export const CATEGORIES = [
  {
    slug: "starter",
    title: "启蒙入门",
    subtitle: "从零开口",
    description: "颜色、家人、动物与日常动词，带孩子迈出英语第一步。",
    accent: "#1ec8a5",
    tint: "#e8fff8",
    sortOrder: 10,
    prefixes: ["启蒙"],
  },
  {
    slug: "primary",
    title: "小学进阶",
    subtitle: "趣味拓展",
    description: "课堂、情绪、童话与校园生活，把英语融进小学生的世界。",
    accent: "#3aa0d8",
    tint: "#e8f5ff",
    sortOrder: 20,
    prefixes: ["小学"],
  },
  {
    slug: "junior",
    title: "初中基础",
    subtitle: "表达升级",
    description: "人物描写、日常麻烦、环保与科技，夯实初中核心表达。",
    accent: "#5b8def",
    tint: "#eef3ff",
    sortOrder: 30,
    prefixes: ["初中", "初中高"],
  },
  {
    slug: "senior",
    title: "高中拓展",
    subtitle: "思辨进阶",
    description: "辩论、文化对比与学术技能，面向高中与大学衔接。",
    accent: "#6b7fd7",
    tint: "#f0f2ff",
    sortOrder: 40,
    prefixes: ["高中"],
  },
  {
    slug: "scenes",
    title: "生活场景",
    subtitle: "身临其境",
    description: "机场、医院、银行、餐厅……真实场景对话，开口就能用。",
    accent: "#ff8a4c",
    tint: "#fff4ec",
    sortOrder: 50,
    prefixes: ["场景", "生活"],
  },
  {
    slug: "functions",
    title: "功能表达",
    subtitle: "交际必备",
    description: "道歉、祝贺、比较、投诉——把话说得得体又自然。",
    accent: "#e07a5f",
    tint: "#fff0eb",
    sortOrder: 60,
    prefixes: ["功能"],
  },
  {
    slug: "nouns",
    title: "主题词汇",
    subtitle: "名词积累",
    description: "家居、食物、衣物与装备，按主题成组记忆，记得牢。",
    accent: "#2a9d8f",
    tint: "#eafaf6",
    sortOrder: 70,
    prefixes: ["名词"],
  },
  {
    slug: "hobbies",
    title: "兴趣爱好",
    subtitle: "玩中学",
    description: "摄影、烘焙、游戏与健身，跟着兴趣学英语更轻松。",
    accent: "#e9a820",
    tint: "#fff8e8",
    sortOrder: 80,
    prefixes: ["兴趣"],
  },
  {
    slug: "exams",
    title: "考试备考",
    subtitle: "应试提分",
    description: "四六级、雅思、托福与考研词汇写作，冲刺目标分数。",
    accent: "#c45c7a",
    tint: "#fff0f4",
    sortOrder: 90,
    prefixes: ["四六级", "雅思", "托福", "考研", "考试"],
  },
  {
    slug: "pro",
    title: "专业职场",
    subtitle: "行业英语",
    description: "商务、医疗、法律与科技等专业场景，服务升学与求职。",
    accent: "#0f2438",
    tint: "#eef2f6",
    sortOrder: 100,
    prefixes: ["专业"],
  },
];

/** All courses are freely downloadable (kept for sync compatibility). */
export const FREE_SLUGS = null;

/**
 * @param {string} title
 * @returns {string} category slug
 */
export function categorySlugForTitle(title) {
  const raw = String(title || "").trim();
  if (!raw.includes("·")) {
    // Special cases without prefix
    if (raw.includes("便利店") || raw.includes("对话")) return "scenes";
    return "scenes";
  }
  const prefix = raw.split("·")[0].trim();
  for (const cat of CATEGORIES) {
    if (cat.prefixes.includes(prefix)) return cat.slug;
  }
  return "scenes";
}

/**
 * @param {number | null | undefined} difficulty
 */
export function levelLabel(difficulty) {
  const map = {
    1: "入门",
    2: "初级",
    3: "中级",
    4: "进阶",
    5: "高级",
  };
  return map[difficulty] || null;
}
