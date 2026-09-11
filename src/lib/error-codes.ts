/**
 * Stable machine-readable API error codes for app i18n.
 * Chinese `error` text stays for old clients; prefer these `code` values.
 *
 * Style: SCREAMING_SNAKE for new codes. A few legacy snake_case codes
 * (rate_limited, invalid_credentials, failed, deleted) are kept as-is.
 */

export const ErrorCode = {
  // Legacy / already shipped
  INSUFFICIENT_DIAMONDS: "INSUFFICIENT_DIAMONDS",
  RATE_LIMITED: "rate_limited",
  INVALID_CREDENTIALS: "invalid_credentials",
  FAILED: "failed",
  DELETED: "deleted",
  ALREADY_PROCESSED: "ALREADY_PROCESSED",

  // Auth / session
  LOGIN_REQUIRED: "LOGIN_REQUIRED",
  LOGIN_REQUIRED_PAY: "LOGIN_REQUIRED_PAY",
  LOGIN_REQUIRED_VIP: "LOGIN_REQUIRED_VIP",
  LOGIN_REQUIRED_DIAMONDS: "LOGIN_REQUIRED_DIAMONDS",
  BAD_PARAMS: "BAD_PARAMS",
  USERNAME_TAKEN: "USERNAME_TAKEN",
  USER_NOT_FOUND: "USER_NOT_FOUND",
  ACCOUNT_NOT_FOUND: "ACCOUNT_NOT_FOUND",
  BAD_PASSWORD: "BAD_PASSWORD",
  BAD_CURRENT_PASSWORD: "BAD_CURRENT_PASSWORD",
  LOGIN_FAILED: "LOGIN_FAILED",
  REGISTER_FAILED: "REGISTER_FAILED",
  SAVE_FAILED: "SAVE_FAILED",
  DELETE_FAILED: "DELETE_FAILED",
  UPDATE_FAILED: "UPDATE_FAILED",
  SEND_FAILED: "SEND_FAILED",
  BIND_FAILED: "BIND_FAILED",
  RESET_FAILED: "RESET_FAILED",
  VERIFY_FAILED: "VERIFY_FAILED",
  BAD_EMAIL: "BAD_EMAIL",
  EMAIL_TAKEN: "EMAIL_TAKEN",
  EMAIL_ALREADY_BOUND: "EMAIL_ALREADY_BOUND",
  EMAIL_NOT_BOUND: "EMAIL_NOT_BOUND",
  NICKNAME_TAKEN: "NICKNAME_TAKEN",
  NICKNAME_REQUIRED: "NICKNAME_REQUIRED",
  NICKNAME_TOO_LONG: "NICKNAME_TOO_LONG",
  NICKNAME_INVALID: "NICKNAME_INVALID",
  NICKNAME_PROFANE: "NICKNAME_PROFANE",
  PASSWORD_SAME: "PASSWORD_SAME",
  CODE_SEND_FAILED: "CODE_SEND_FAILED",
  VERIFY_CODE_REQUIRED: "VERIFY_CODE_REQUIRED",
  VERIFY_CODE_EXPIRED: "VERIFY_CODE_EXPIRED",
  VERIFY_CODE_MISMATCH: "VERIFY_CODE_MISMATCH",
  VERIFY_CODE_TOO_MANY: "VERIFY_CODE_TOO_MANY",
  VERIFY_CODE_FORMAT: "VERIFY_CODE_FORMAT",
  AVATAR_CANDIDATES_FAILED: "AVATAR_CANDIDATES_FAILED",
  UNSUPPORTED_AVATAR: "UNSUPPORTED_AVATAR",
  UNSUPPORTED_AVATAR_STYLE: "UNSUPPORTED_AVATAR_STYLE",

  // VIP / pay / IAP
  CREATE_ORDER_FAILED: "CREATE_ORDER_FAILED",
  VIP_PLAN_INVALID: "VIP_PLAN_INVALID",
  DIAMOND_PACK_INVALID: "DIAMOND_PACK_INVALID",
  PRODUCT_RECEIPT_MISMATCH: "PRODUCT_RECEIPT_MISMATCH",
  APPLE_TX_PROCESSED: "APPLE_TX_PROCESSED",
  GOOGLE_TX_PROCESSED: "GOOGLE_TX_PROCESSED",
  APPLE_NOT_THIS_ACCOUNT: "APPLE_NOT_THIS_ACCOUNT",
  GOOGLE_NOT_THIS_ACCOUNT: "GOOGLE_NOT_THIS_ACCOUNT",
  SUB_BOUND_OTHER_ACCOUNT: "SUB_BOUND_OTHER_ACCOUNT",
  GOOGLE_BOUND_OTHER_ACCOUNT: "GOOGLE_BOUND_OTHER_ACCOUNT",
  APPLE_SUB_EXPIRED: "APPLE_SUB_EXPIRED",
  UNKNOWN_APPLE_PRODUCT: "UNKNOWN_APPLE_PRODUCT",
  UNKNOWN_GOOGLE_PRODUCT: "UNKNOWN_GOOGLE_PRODUCT",
  UNKNOWN_VIP_PLAN: "UNKNOWN_VIP_PLAN",
  UNKNOWN_DIAMOND_PACK: "UNKNOWN_DIAMOND_PACK",
  ORDER_NOT_FOUND: "ORDER_NOT_FOUND",
  MISSING_ORDER_NO: "MISSING_ORDER_NO",
  ORDER_QUERY_FAILED: "ORDER_QUERY_FAILED",
  VIP_PURCHASE_FAILED: "VIP_PURCHASE_FAILED",
  USE_ALIPAY_FOR_VIP: "USE_ALIPAY_FOR_VIP",
  APPLE_VERIFY_FAILED: "APPLE_VERIFY_FAILED",
  PLAN_APP_STORE_ONLY: "PLAN_APP_STORE_ONLY",
  PAYMENT_FAILED: "PAYMENT_FAILED",

  // Misc high-traffic
  LOAD_FAILED: "LOAD_FAILED",
  SUBMIT_FAILED: "SUBMIT_FAILED",
  GENERATE_COURSE_FAILED: "GENERATE_COURSE_FAILED",
  SUGGEST_WORDS_FAILED: "SUGGEST_WORDS_FAILED",
  GENERATE_DICT_FAILED: "GENERATE_DICT_FAILED",
  PERMANENT_VIP_ONLY: "PERMANENT_VIP_ONLY",
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Exact Chinese (or legacy English) `error` strings → stable codes. */
export const ERROR_MESSAGE_TO_CODE: Record<string, ErrorCodeValue> = {
  // Legacy delete-account English bodies
  rate_limited: ErrorCode.RATE_LIMITED,
  invalid_credentials: ErrorCode.INVALID_CREDENTIALS,
  failed: ErrorCode.FAILED,
  deleted: ErrorCode.DELETED,

  "请先登录": ErrorCode.LOGIN_REQUIRED,
  "请先登录后再支付": ErrorCode.LOGIN_REQUIRED_PAY,
  "请先登录后再开通会员": ErrorCode.LOGIN_REQUIRED_VIP,
  "请先登录后再充值钻石": ErrorCode.LOGIN_REQUIRED_DIAMONDS,
  "参数错误": ErrorCode.BAD_PARAMS,
  "用户名已被注册": ErrorCode.USERNAME_TAKEN,
  "用户不存在": ErrorCode.USER_NOT_FOUND,
  "账号不存在": ErrorCode.ACCOUNT_NOT_FOUND,
  "密码错误": ErrorCode.BAD_PASSWORD,
  "当前密码不正确": ErrorCode.BAD_CURRENT_PASSWORD,
  "登录失败，请稍后重试": ErrorCode.LOGIN_FAILED,
  "注册失败，请稍后重试": ErrorCode.REGISTER_FAILED,
  "保存失败，请稍后重试": ErrorCode.SAVE_FAILED,
  "删除失败，请稍后重试": ErrorCode.DELETE_FAILED,
  "修改失败，请稍后重试": ErrorCode.UPDATE_FAILED,
  "发送失败，请稍后重试": ErrorCode.SEND_FAILED,
  "绑定失败，请稍后重试": ErrorCode.BIND_FAILED,
  "重置失败，请稍后重试": ErrorCode.RESET_FAILED,
  "校验失败，请稍后重试": ErrorCode.VERIFY_FAILED,
  "邮箱格式不正确": ErrorCode.BAD_EMAIL,
  "该邮箱已被其他账号绑定": ErrorCode.EMAIL_TAKEN,
  "该邮箱已绑定到当前账号": ErrorCode.EMAIL_ALREADY_BOUND,
  "该邮箱未绑定账号": ErrorCode.EMAIL_NOT_BOUND,
  "该昵称已被使用": ErrorCode.NICKNAME_TAKEN,
  "请输入昵称": ErrorCode.NICKNAME_REQUIRED,
  "昵称包含无效字符": ErrorCode.NICKNAME_INVALID,
  "请输入有效昵称": ErrorCode.NICKNAME_INVALID,
  "昵称包含不当内容，请更换后重试": ErrorCode.NICKNAME_PROFANE,
  "新密码不能与当前密码相同": ErrorCode.PASSWORD_SAME,
  "验证码发送失败，请稍后重试": ErrorCode.CODE_SEND_FAILED,
  "请先获取验证码": ErrorCode.VERIFY_CODE_REQUIRED,
  "验证码已过期，请重新获取": ErrorCode.VERIFY_CODE_EXPIRED,
  "验证码错误": ErrorCode.VERIFY_CODE_MISMATCH,
  "验证次数过多，请重新获取验证码": ErrorCode.VERIFY_CODE_TOO_MANY,
  "请输入 6 位数字验证码": ErrorCode.VERIFY_CODE_FORMAT,
  "获取头像候选失败，请稍后重试": ErrorCode.AVATAR_CANDIDATES_FAILED,
  "不支持的卡通形象": ErrorCode.UNSUPPORTED_AVATAR,
  "不支持的头像风格": ErrorCode.UNSUPPORTED_AVATAR_STYLE,

  "创建订单失败，请稍后重试": ErrorCode.CREATE_ORDER_FAILED,
  "创建订单失败": ErrorCode.CREATE_ORDER_FAILED,
  "请选择有效的会员方案": ErrorCode.VIP_PLAN_INVALID,
  "请选择有效的钻石套餐": ErrorCode.DIAMOND_PACK_INVALID,
  "商品与凭证不一致": ErrorCode.PRODUCT_RECEIPT_MISMATCH,
  "该 Apple 交易已处理": ErrorCode.APPLE_TX_PROCESSED,
  "该 Google 交易已处理": ErrorCode.GOOGLE_TX_PROCESSED,
  "该 Apple 购买不属于当前账号": ErrorCode.APPLE_NOT_THIS_ACCOUNT,
  "该 Google 购买不属于当前账号": ErrorCode.GOOGLE_NOT_THIS_ACCOUNT,
  "该订阅已绑定其他账号，请使用原账号登录后恢复购买": 
    ErrorCode.SUB_BOUND_OTHER_ACCOUNT,
  "该 Google 购买已绑定其他账号": ErrorCode.GOOGLE_BOUND_OTHER_ACCOUNT,
  "该 Apple 订阅已过期": ErrorCode.APPLE_SUB_EXPIRED,
  "未知的 Apple 商品": ErrorCode.UNKNOWN_APPLE_PRODUCT,
  "未知的 Google Play 商品": ErrorCode.UNKNOWN_GOOGLE_PRODUCT,
  "未知的会员方案": ErrorCode.UNKNOWN_VIP_PLAN,
  "未知的钻石套餐": ErrorCode.UNKNOWN_DIAMOND_PACK,
  "订单不存在": ErrorCode.ORDER_NOT_FOUND,
  "缺少订单号": ErrorCode.MISSING_ORDER_NO,
  "查询订单失败": ErrorCode.ORDER_QUERY_FAILED,
  "开通失败，请稍后重试": ErrorCode.VIP_PURCHASE_FAILED,
  "请使用支付宝支付开通会员": ErrorCode.USE_ALIPAY_FOR_VIP,
  "Apple 凭证校验失败，请稍后重试": ErrorCode.APPLE_VERIFY_FAILED,
  "该方案仅支持 App Store 订阅": ErrorCode.PLAN_APP_STORE_ONLY,

  "加载失败": ErrorCode.LOAD_FAILED,
  "提交失败": ErrorCode.SUBMIT_FAILED,
  "生成课程失败，请稍后重试": ErrorCode.GENERATE_COURSE_FAILED,
  "推荐单词失败，请稍后重试": ErrorCode.SUGGEST_WORDS_FAILED,
  "生成词条失败，请稍后重试": ErrorCode.GENERATE_DICT_FAILED,
  "仅永久会员可使用": ErrorCode.PERMANENT_VIP_ONLY,
  "请求过于频繁，请过段时间再试": ErrorCode.RATE_LIMITED,

  // Diamonds (also exported from vip.ts)
  "钻石不足，请充值后再试": ErrorCode.INSUFFICIENT_DIAMONDS,
  "钻石不足": ErrorCode.INSUFFICIENT_DIAMONDS,
};

const NICKNAME_TOO_LONG_RE = /^昵称不能超过 \d+ 个字符$/;

/**
 * Resolve a stable code from an optional explicit code and/or known message.
 * Dynamic rate-limit strings with seconds are left uncoded on purpose so the
 * client can keep the seconds via message regex.
 */
export function resolveErrorCode(
  message: string,
  explicit?: string | null,
): string | undefined {
  if (explicit && String(explicit).trim()) return String(explicit);
  const trimmed = (message || "").trim();
  if (!trimmed) return undefined;
  const mapped = ERROR_MESSAGE_TO_CODE[trimmed];
  if (mapped) return mapped;
  if (NICKNAME_TOO_LONG_RE.test(trimmed)) return ErrorCode.NICKNAME_TOO_LONG;
  return undefined;
}
