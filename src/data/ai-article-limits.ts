/** 文章模式输入长度限制（前后端共用） */

/** 过短无法拆出足够句子 */
export const ARTICLE_MIN_CHARS = 80;

/**
 * 约 150～200 词 / 8～15 句。
 * 再长容易撑爆 AI JSON 回复。
 */
export const ARTICLE_MAX_CHARS = 1200;
