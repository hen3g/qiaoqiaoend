import type { PracticeMode } from "@/data/practice-modes";

export type CoursePromptOptions = {
  /** 简约模式：不生成 tokens 词级拆解，降低输出量 */
  liteMode?: boolean;
};

/** JSON 结构说明（各模式共用字段；tokens 按简约模式开关） */
function courseJsonShape(liteMode: boolean): string {
  const tokensBlock = liteMode
    ? ""
    : `,
          "tokens": [
            {
              "en": "hello",
              "zh": "你好",
              "zhDetail": "见面打招呼时说的话，相当于中文的「你好」。",
              "ipa": "/həˈləʊ/",
              "pos": "感叹词",
              "role": "word"
            }
          ]`;

  const phraseTokens = liteMode
    ? ""
    : `,
          "tokens": [
            {
              "en": "my",
              "zh": "我的",
              "zhDetail": "物主限定词，说明书是「我的」，修饰后面的名词。",
              "ipa": "/maɪ/",
              "pos": "限定词",
              "role": "attributive"
            },
            {
              "en": "book",
              "zh": "书",
              "zhDetail": "短语的中心名词，整段意思是「我的书」。",
              "ipa": "/bʊk/",
              "pos": "名词",
              "role": "head"
            }
          ]`;

  const sentenceTokens = liteMode
    ? ""
    : `,
          "tokens": [
            {
              "en": "I",
              "zh": "我",
              "zhDetail": "主语，动作的发出者。",
              "ipa": "/aɪ/",
              "pos": "代词",
              "role": "subject"
            },
            {
              "en": "like",
              "zh": "喜欢",
              "zhDetail": "谓语动词，表示主语的喜好。",
              "ipa": "/laɪk/",
              "pos": "动词",
              "role": "predicate"
            },
            {
              "en": "apples",
              "zh": "苹果",
              "zhDetail": "宾语；用复数表示这一类水果。",
              "ipa": "/ˈæplz/",
              "pos": "名词",
              "role": "object"
            }
          ]`;

  const dialogueTokens = liteMode
    ? ""
    : `,
          "tokens": [
            {
              "en": "Welcome",
              "zh": "欢迎",
              "zhDetail": "招呼语，欢迎对方到来。",
              "ipa": "/ˈwelkəm/",
              "pos": "感叹词",
              "role": "word"
            }
          ]`;

  const tokensRules = liteMode
    ? `
【简约模式 —— 禁止输出 tokens】
本请求为简约模式：每道练习只需 id/en/zh/ipa/level（对话另加 speaker）。
严禁输出 tokens 字段，也不要生成词级拆解、zhDetail、pos、role。
这样可显著缩短回复、降低 token 消耗。
`.trim()
    : `
【学习模式 tokens —— 每道练习必须填写，字段枚举必须精确匹配】
答对后会展示词卡预习，因此每道 sentence 都必须带 tokens 数组。
1. level=word：tokens 恰好 1 项，内容与本条 en/zh/ipa 一致，role 必须是 "word"。
2. level=phrase 或 sentence：按空格拆成词（保留原拼写如 apples、an），tokens 数量 = 拆词数量，顺序与 en 一致。
3. 每个 token 必填：en、zh、zhDetail、ipa、pos、role。
4. pos 必须是下列中文标签之一（禁止写英文 n./v./adj.）：
   "感叹词" | "代词" | "动词" | "系动词" | "助动词" | "名词" | "形容词" | "副词" | "冠词" | "限定词" | "介词" | "连词" | "数词" | "疑问词"
   can/could/will/would/shall/should/may/might/must 等一律用 "助动词"，禁止写「情态动词」。
5. role 必须是下列英文字符串之一（禁止写中文「主语/谓语」，禁止写 verb/modifier/determiner）：
   "word" | "subject" | "predicate" | "object" | "attributive" | "adverbial" | "complement" | "vocative" | "head"
   含义对照（仅帮助理解，输出时仍用左侧英文 key）：
   - word = 单词级 / 招呼语等
   - subject = 主语
   - predicate = 谓语（含实义动词、系动词、助动词作谓语核；禁止写成 "verb"）
   - object = 宾语
   - attributive = 定语（a/an/my/happy 等；禁止写成 "modifier"/"determiner"）
   - adverbial = 状语
   - complement = 补语/表语（is happy 的 happy）
   - vocative = 称呼语
   - head = 短语中心语
6. zhDetail 要具体、口语化，适合启蒙学习者；可点明在本句中的作用。
7. 对话题同样必须为每句生成 tokens；speaker 仍只放在练习顶层。
8. 自检：输出前确认每个 token.role 都落在第 5 条枚举里，每个 token.pos 都落在第 4 条枚举里。
`.trim();

  return `
你必须只输出一个合法的 JSON 对象（不要 markdown，不要解释），结构如下：

{
  "id": "英文短横线 id，如 travel-basics",
  "title": "中文课程标题",
  "description": "一两句中文简介",
  "difficulty": 1到5的整数（1最简单，5最难）,
  "durationMinutes": 预计完成分钟数（整数）,
  "practiceMode": "progressive" | "sentences" | "dialogue" | "article",
  "lessons": [
    {
      "id": "lesson-1",
      "title": "第 1 课 · 主题",
      "words": [
        { "id": "hello", "en": "hello", "zh": "你好", "ipa": "/həˈləʊ/" }
      ],
      "sentences": [
        {
          "id": "w1",
          "en": "hello",
          "zh": "你好",
          "ipa": "/həˈləʊ/",
          "level": "word"${tokensBlock}
        },
        {
          "id": "p1",
          "en": "my book",
          "zh": "我的书",
          "ipa": "/maɪ bʊk/",
          "level": "phrase"${phraseTokens}
        },
        {
          "id": "s1",
          "en": "I like apples.",
          "zh": "我喜欢苹果。",
          "ipa": "/aɪ laɪk ˈæplz/",
          "level": "sentence"${sentenceTokens}
        },
        {
          "id": "d1",
          "speaker": "A",
          "en": "Welcome!",
          "zh": "欢迎光临。",
          "ipa": "/ˈwelkəm/",
          "level": "sentence"${dialogueTokens}
        }
      ]
    }
  ]
}

通用规则：
1. practiceMode 必须与用户指定的模式一致。
2. sentences 的 level 只能是 "word" | "phrase" | "sentence"。
3. 练习英文 en 是用户要敲出的内容；标点会自动显示、用户无需敲入。level=sentence（含对话）的 en 必须带自然句末标点（. ? !），问句用问号、感叹用感叹号；level=word / phrase 一般不加句末标点。
4. 音标 ipa 使用国际音标，用斜杠包裹。
5. 单词 ≤ 8 个时生成 1 课；9～16 个生成 2 课；更多可到 3 课。每课 words 建议 5～8 个（对话模式可少填或不填扩展词）。
6. id 只用小写英文字母、数字和短横线。
7. 若用户提供了单词列表，必须全部纳入课程（写入 words，并在练习中覆盖使用）。
8. 若用户提供了场景/主题，标题、描述和练习都必须贴合该场景。
9. durationMinutes 按练习量估算（大约每 3 道练习 1 分钟）。
10. 情景对话必须用 speaker 字段标记说话人（如 "A"/"B"/"C"）；en 与 zh 正文里禁止出现 "A:"、"B:" 等前缀。

${tokensRules}
`.trim();
}

function modeRules(mode: PracticeMode, liteMode: boolean): string {
  const tokensLine = liteMode
    ? "不要输出 tokens 字段。"
    : "每道练习都必须带完整 tokens。";

  const rules: Record<PracticeMode, string> = {
    progressive: `
本模式规则（循序渐进 progressive）：
1. 练习顺序必须是：先全部 word，再 phrase，再 sentence。
2. 每个单词都必须有一道 level=word 的练习。
3. phrase 数量 ≥ 单词数；sentence 数量 ≥ 单词数。
4. 单课 sentences 总数 ≥ 单词数 × 3（例如 8 个词至少 24 道练习）。
5. 短语和句子要尽量组合多个本课单词，贴合场景；sentence 级 en 须带句末标点。
6. 不要填写 speaker 字段。
7. ${tokensLine}
`.trim(),

    sentences: `
本模式规则（全造句 sentences）：
1. 所有 sentences 的 level 必须是 "sentence"，禁止生成 word / phrase 练习。
2. 仍须把用户单词完整写入每课 words。
3. sentences 总数 ≥ max(16, 单词数 × 2)；尽量让每个单词至少出现在 2 句里。
4. 句子要自然实用，优先组合多个本课单词，贴合场景；每句 en 须带句末标点。
5. 不要填写 speaker 字段。
6. ${
      liteMode
        ? "不要输出 tokens 字段。"
        : "每道句子练习都必须带完整 tokens（按词拆开，标清主谓宾定状补等 role）。"
    }
`.trim(),

    dialogue: `
本模式规则（情景对话 dialogue）：
1. 所有 sentences 的 level 必须是 "sentence"。
2. 每道练习必须有 speaker 字段，取值如 "A"、"B"（两人对话）或 "A"/"B"/"C"；按轮次交替。
3. en 与 zh 只写台词正文，严禁写成 "A: …" 或 "B: …"；说话人只放在 speaker 里；台词须带自然标点。
4. 把用户单词自然融入对白；words 写入用户单词供提示（可为空数组，但不推荐）。
5. 对话轮次（sentences）总数 ≥ max(16, 单词数 × 2)，内容连贯成一个小场景。
6. 不要生成孤立的单词卡或短语卡练习。
7. ${
      liteMode
        ? "不要输出 tokens 字段。"
        : "每一句对白都必须带完整 tokens（按词拆开；招呼语可用 role=word）。"
    }
`.trim(),

    article: `
本模式规则（文章模式 article）：
1. 所有 sentences 的 level 必须是 "sentence"，禁止 word / phrase，禁止填写 speaker。
2. 按用户文章的语义顺序拆成可打字的单句（按 . ? ! 断句；过长句可拆成两句，但不得乱序、不得编造无关情节）。
3. en 尽量贴近原文用词并保留原文标点；zh 为准确中文译义。
4. 从文中抽取 6～12 个高价值词或短语写入各课 words（供提示，不生成单词卡练习）。
5. 题量须覆盖拆出的全部句子；短文可在忠实前提下轻微补全到 ≥8 句；通常 1 课即可（句子多时可 2 课），总题量建议 ≤24。
6. difficulty 按文章本身的词汇与句式评估（1 最简单，5 最难），不要为凑难度改写原文。
7. ${
      liteMode
        ? "不要输出 tokens 字段。"
        : "每道句子练习都必须带完整 tokens（按词拆开，标清主谓宾定状补等 role）。"
    }
`.trim(),
  };

  return rules[mode];
}

export function courseJsonSchemaForMode(
  mode: PracticeMode,
  options: CoursePromptOptions = {},
): string {
  const liteMode = options.liteMode !== false;
  return `${courseJsonShape(liteMode)}\n\n${modeRules(mode, liteMode)}`;
}

export function systemGenerateForMode(
  mode: PracticeMode,
  options: CoursePromptOptions = {},
): string {
  const liteMode = options.liteMode !== false;
  const tokensPolicy = liteMode
    ? "简约模式：严禁输出 tokens 词级拆解，只生成练习正文（en/zh/ipa/level 等）。"
    : "每道练习必须包含 tokens 词级拆解，供答对后的学习模式展示。\n硬性约束：token.role 只能是 word/subject/predicate/object/attributive/adverbial/complement/vocative/head（不要用 verb、modifier、determiner 或中文角色名）；token.pos 必须用中文词性标签。";

  return `你是英语课程设计师，为「敲敲英语」打字练习 App 生成课程 JSON。
当前练习模式：${mode}。练习题必须够多，宁可多写几句，也不要只给寥寥几道。
${tokensPolicy}
${courseJsonSchemaForMode(mode, { liteMode })}`;
}

export function systemReviseForMode(
  mode: PracticeMode,
  options: CoursePromptOptions = {},
): string {
  const liteMode = options.liteMode !== false;
  const tokensPolicy = liteMode
    ? "简约模式：不要新增或补全 tokens；输出中请省略 tokens 字段。"
    : "修改或新增的每道练习都必须带完整 tokens；若旧题缺少 tokens，请一并补全。";

  return `你是英语课程设计师，根据用户要求修改已有课程 JSON，并输出完整的新 JSON（不是 diff）。
保留合理的 id（尤其是课程 id），除非用户要求换主题。
保持 practiceMode 为「${mode}」，并继续遵守该模式规则。
若用户要求加长/加题，务必明显增加 sentences 数量。
${tokensPolicy}
${courseJsonSchemaForMode(mode, { liteMode })}`;
}

/** @deprecated 默认循序渐进；新代码请用 systemGenerateForMode */
export const SYSTEM_GENERATE = systemGenerateForMode("progressive");

/** @deprecated 默认循序渐进；新代码请用 systemReviseForMode */
export const SYSTEM_REVISE = systemReviseForMode("progressive");

export const SYSTEM_SUGGEST_WORDS = `你是英语词汇助教。用户只用一句话描述想学什么，你负责理解意图并推荐适合「看中文敲英文」练习的单词。
用户可能说：教材课文（如「新概念第一册第3课」）、考试范围（如「雅思口语 Part1 家乡」「考研英语核心词」）、学段（如「初中八年级上册 unit2」）、生活场景（如「出国旅游常用」）等。请自行推断主题与难度；单词数量以用户消息中的要求为准。
只输出合法 JSON（不要 markdown，不要解释）：
{
  "theme": "新概念英语第一册第3课",
  "difficulty": 2,
  "words": [
    { "en": "airport", "zh": "机场" },
    { "en": "passport", "zh": "护照" }
  ]
}
规则：
1. theme：用简短中文概括用户意图（可作课程场景标题），不要空。
2. difficulty：1～5 的整数（1 启蒙，2 初学，3 中等，4 较难，5 高阶），按教材/考试/场景自动判断。
3. 数量：按用户指定尽量贴合（±2 可接受）；未指定时推荐 14～20 个，最多不超过 30 个。
4. en 为小写英文单词或常见短语（短语不超过 3 个词）；zh 为简洁中文释义。
5. 若提到具体教材课文/单元，优先覆盖该课真实高频核心词（按你的知识尽量贴近原课）；不确定时选该难度下最贴题的实用词，勿编造课文编号以外的假内容当依据。
6. 单词要能组成该主题下的实用短句；不要重复，不要编号，避免生僻词（除非用户明确要求）。`;
