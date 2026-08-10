/** Client-side nickname content filter (uncivil / sexual / political / scam). */

export const MAX_NICKNAME_LENGTH = 32;

/** Homoglyph / leetspeak substitutions for bypass attempts. */
const CHAR_MAP: Record<string, string> = {
  "０": "0",
  "１": "1",
  "２": "2",
  "３": "3",
  "４": "4",
  "５": "5",
  "６": "6",
  "７": "7",
  "８": "8",
  "９": "9",
  ａ: "a",
  ｂ: "b",
  ｃ: "c",
  ｄ: "d",
  ｅ: "e",
  ｆ: "f",
  ｇ: "g",
  ｈ: "h",
  ｉ: "i",
  ｊ: "j",
  ｋ: "k",
  ｌ: "l",
  ｍ: "m",
  ｎ: "n",
  ｏ: "o",
  ｐ: "p",
  ｑ: "q",
  ｒ: "r",
  ｓ: "s",
  ｔ: "t",
  ｕ: "u",
  ｖ: "v",
  ｗ: "w",
  ｘ: "x",
  ｙ: "y",
  ｚ: "z",
  "＠": "@",
  "！": "!",
  "＃": "#",
  "＄": "$",
  "％": "%",
  "＆": "&",
  "＊": "*",
  "（": "(",
  "）": ")",
  "－": "-",
  "＿": "_",
  "＋": "+",
  "＝": "=",
  "｜": "|",
  "／": "/",
  "＼": "\\",
  "．": ".",
  "，": ",",
  "：": ":",
  "；": ";",
  "？": "?",
  "～": "~",
  "·": "",
  "・": "",
  "•": "",
  "●": "",
  "○": "",
  "〇": "0",
  "零": "0",
};

const SEPARATOR_RE =
  /[\s\-_/\\|.*·•●○★☆✦✧◆◇■□▪▫【】\[\]{}（）()「」『』<>《》""''`~!@#$%^&+=:;,?]+/g;

/**
 * Substring match (good for Chinese / multi-char phrases).
 * Avoid very short English tokens here — those use WHOLE_WORD_TERMS.
 */
const BLOCKED_SUBSTRINGS: string[] = [
  // —— 脏话 / 不文明 ——
  "傻逼",
  "傻b",
  "傻比",
  "傻叉",
  "傻缺",
  "傻帽",
  "白痴",
  "脑残",
  "智障",
  "弱智",
  "蠢货",
  "混蛋",
  "浑蛋",
  "王八蛋",
  "王八羔子",
  "狗日",
  "狗崽",
  "畜生",
  "去死",
  "找死",
  "烂人",
  "贱人",
  "贱货",
  "婊子",
  "婊砸",
  "臭婊子",
  "他妈",
  "你妈",
  "妈的",
  "妈逼",
  "妈b",
  "草泥马",
  "操你妈",
  "操你",
  "日你",
  "艹你",
  "干你娘",
  "干你妈",
  "我靠",
  "我操",
  "卧槽",
  "尼玛",
  "泥马",
  "特么",
  "他么的",
  "去死吧",
  "滚你妈",
  "滚蛋",
  "屁眼",
  "吃屎",
  "粪坑",
  "垃圾人",
  "人渣",
  "败类",
  "杂种",
  "野种",
  "骚货",
  "骚逼",
  "骚b",
  "臭逼",
  "烂逼",
  "死全家",
  "全家死",
  "nmsl",
  "cnm",
  "tmd",
  "tmmd",
  "mlgb",
  "wdnmd",
  "fuck",
  "fucker",
  "fucking",
  "motherfucker",
  "asshole",
  "dickhead",
  "bastard",
  "bitch",

  // —— 色情 / 低俗 ——
  "色情",
  "黄片",
  "黄网",
  "黄图",
  "淫秽",
  "淫荡",
  "淫乱",
  "色情片",
  "成人片",
  "av女优",
  "女优",
  "约炮",
  "一夜情",
  "援交",
  "包养",
  "开房约",
  "打炮",
  "操逼",
  "插逼",
  "口交",
  "肛交",
  "群交",
  "乱伦",
  "强奸",
  "轮奸",
  "迷奸",
  "卖淫",
  "嫖娼",
  "妓女",
  "鸡奸",
  "自慰",
  "手淫",
  "射精",
  "阴茎",
  "阴道",
  "阴蒂",
  "阴唇",
  "奶子",
  "鸡巴",
  "鸡吧",
  "阳具",
  "肉棒",
  "肉穴",
  "骚穴",
  "浪穴",
  "无码",
  "有码av",
  "内射",
  "中出",
  "潮吹",
  "露点",
  "裸聊",
  "裸贷",
  "裸体",
  "全裸",
  "脱衣舞",
  "色情直播",
  "直播色情",
  "色情网站",
  "色情软件",
  "成人网站",
  "成人软件",
  "色情服务",
  "性服务",
  "性交易",
  "性奴",
  "性虐",
  "sm调教",
  "调教奴",
  "porn",
  "porno",
  "hentai",
  "nsfw",
  "onlyfans",
  "camgirl",
  "blowjob",
  "handjob",
  "cumshot",
  "orgasm",
  "dildo",
  "vibrator",
  "incest",
  "rapist",
  "prostitute",
  "hooker",
  "whore",
  "boobs",
  "pussy",
  "penis",
  "vagina",
  "fetish",

  // —— 政治敏感 / 分裂煽动 ——
  "习近平",
  "习主席",
  "习大大",
  "习包子",
  "习禁评",
  "毛泽东",
  "周恩来",
  "邓小平",
  "江泽民",
  "胡锦涛",
  "李克强",
  "温家宝",
  "彭丽媛",
  "王岐山",
  "薄熙来",
  "周永康",
  "令计划",
  "法轮功",
  "法轮大法",
  "李洪志",
  "六四事件",
  "六四屠",
  "天安门事件",
  "八九学潮",
  "独立台湾",
  "台独",
  "港独",
  "藏独",
  "疆独",
  "东突",
  "东突厥",
  "分裂国家",
  "推翻共产党",
  "打倒共产党",
  "反共",
  "灭共",
  "共匪",
  "中共邪",
  "邪党",
  "达赖喇嘛",
  "疆独分子",
  "恐怖分子",
  "圣战组织",
  "基地组织",
  "纳粹",
  "希特勒",
  "法西斯",
  "零八宪章",
  "刘晓波",
  "自由亚洲",
  "大纪元",
  "新唐人",
  "明慧网",
  "天灭中共",
  "打倒中共",
  "共产党下台",
  "一党独裁",
  "专制暴政",
  "xijinping",
  "xi jinping",
  "falungong",
  "falun gong",
  "freetibet",
  "free tibet",
  "taiwanindependence",
  "hongkongindependence",

  // —— 歧视 / 仇恨 ——
  "尼哥",
  "黑鬼",
  "支那猪",
  "支那人",
  "倭寇",
  "小日本鬼子",
  "东亚病夫",
  "死回回",
  "伊斯兰国",
  "种族清洗",
  "种族灭绝",
  "优等民族",
  "劣等民族",
  "nigger",
  "nigga",
  "chink",
  "raghead",
  "heilhitler",
  "whitepower",

  // —— 毒品 / 违禁 ——
  "冰毒",
  "海洛因",
  "大麻烟",
  "摇头丸",
  "k粉",
  "可卡因",
  "鸦片",
  "吸毒",
  "贩毒",
  "制毒",
  "毒品交易",
  "heroin",
  "cocaine",
  "marijuana",
  "fentanyl",
  "ecstasy",

  // —— 暴力极端 ——
  "杀光",
  "屠杀",
  "自杀指导",
  "如何自杀",
  "炸弹制作",
  "制作炸弹",
  "枪支买卖",
  "灭门",
  "schoolshooter",
  "bombmaking",
  "killyourself",

  // —— 诈骗 / 冒充官方 ——
  "管理员",
  "系统管理员",
  "官方客服",
  "官方人员",
  "官方账号",
  "官方认证",
  "官方代表",
  "平台客服",
  "客服专员",
  "客服小姐",
  "客服小哥",
  "总管理员",
  "超管",
  "administrator",
  "customerservice",
  "supportteam",
  "系统通知",
  "系统消息",
  "微信客服",
  "支付宝客服",
  "银行客服",
  "国家主席",
  "总书记",
  "中纪委",
  "中央军委",
  // 短中文词：中文无空格，用子串匹配
  "客服",
  "官方",
  "邪教",
  "共党",
  "达赖",
  "民运",
  "退党",
  "三退",
  "文革",
  "红卫兵",
  "学潮",
  "六四",
  "近平",
];

/**
 * Short / ambiguous Latin tokens — match only as whole tokens
 * (full nickname, or not embedded inside a longer Latin word).
 */
const WHOLE_WORD_TERMS: string[] = [
  "sb",
  "nmb",
  "wtf",
  "stfu",
  "kys",
  "sex",
  "sexy",
  "xxx",
  "anal",
  "cock",
  "slut",
  "rape",
  "nude",
  "naked",
  "shit",
  "weed",
  "meth",
  "mdma",
  "isis",
  "isil",
  "kkk",
  "gook",
  "kike",
  "spic",
  "admin",
  "official",
  "moderator",
];
const BLOCKED_SUBSTRINGS_N = Array.from(
  new Set(BLOCKED_SUBSTRINGS.map((t) => normalizeForMatch(t)).filter((t) => t.length >= 2)),
).sort((a, b) => b.length - a.length);

const WHOLE_WORD_N = Array.from(
  new Set(WHOLE_WORD_TERMS.map((t) => normalizeForMatch(t)).filter(Boolean)),
);

export type NicknameValidation =
  | { ok: true; nickname: string }
  | { ok: false; message: string };

function mapChar(ch: string): string {
  return CHAR_MAP[ch] ?? ch;
}

/** Collapse obfuscation so "操 你 妈" / "f.u.c.k" still match. */
export function normalizeForMatch(raw: string): string {
  let out = "";
  for (const ch of raw.normalize("NFKC")) {
    out += mapChar(ch);
  }
  out = out.toLowerCase();
  out = out.replace(SEPARATOR_RE, "");
  out = out
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/\$/g, "s")
    .replace(/@/g, "a");
  return out;
}

function isLetterOrDigit(ch: string | undefined): boolean {
  if (!ch) return false;
  return /[a-z0-9\u4e00-\u9fff]/.test(ch);
}

function containsWholeWord(normalized: string, term: string): boolean {
  if (!term) return false;
  if (normalized === term) return true;
  let from = 0;
  while (from <= normalized.length - term.length) {
    const idx = normalized.indexOf(term, from);
    if (idx < 0) return false;
    const before = normalized[idx - 1];
    const after = normalized[idx + term.length];
    if (!isLetterOrDigit(before) && !isLetterOrDigit(after)) {
      return true;
    }
    // For CJK-only terms, also treat as hit when embedded in longer CJK string
    // is handled via BLOCKED_SUBSTRINGS; whole-word list keeps short ones strict.
    from = idx + 1;
  }
  return false;
}

function containsBlockedTerm(normalized: string): boolean {
  for (const term of BLOCKED_SUBSTRINGS_N) {
    if (normalized.includes(term)) return true;
  }
  for (const term of WHOLE_WORD_N) {
    if (containsWholeWord(normalized, term)) return true;
  }
  return false;
}

/**
 * Validate a nickname before create / change.
 * Returns trimmed nickname on success.
 */
export function validateNickname(raw: string): NicknameValidation {
  const nickname = raw.trim();

  if (!nickname) {
    return { ok: false, message: "请输入昵称" };
  }

  if (nickname.length > MAX_NICKNAME_LENGTH) {
    return {
      ok: false,
      message: `昵称不能超过 ${MAX_NICKNAME_LENGTH} 个字符`,
    };
  }

  if (/[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/.test(nickname)) {
    return { ok: false, message: "昵称包含无效字符" };
  }

  const normalized = normalizeForMatch(nickname);
  if (!normalized) {
    return { ok: false, message: "请输入有效昵称" };
  }

  if (containsBlockedTerm(normalized)) {
    return {
      ok: false,
      message: "昵称包含不当内容，请更换后重试",
    };
  }

  return { ok: true, nickname };
}
