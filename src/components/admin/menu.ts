import { isAdminUsername } from "@/lib/admin-username";
import type { SessionUser } from "@/lib/auth";

export type AdminMenuRole = "admin" | "promoter";

export type AdminMenuItem = {
  key: string;
  path: string;
  label: string;
  roles: AdminMenuRole[];
};

export const ADMIN_MENU: AdminMenuItem[] = [
  {
    key: "promoter-cards",
    path: "/admin/promoter-cards",
    label: "推广卡片",
    roles: ["promoter"],
  },
  {
    key: "promoter-users",
    path: "/admin/promoter-users",
    label: "推广用户",
    roles: ["promoter"],
  },
  {
    key: "promoter-orders",
    path: "/admin/promoter-orders",
    label: "推广订单",
    roles: ["promoter"],
  },
  {
    key: "users",
    path: "/admin/users",
    label: "用户后台",
    roles: ["admin"],
  },
  {
    key: "orders",
    path: "/admin/orders",
    label: "支付订单",
    roles: ["admin"],
  },
  {
    key: "user-content",
    path: "/admin/user-content",
    label: "课程与套卷",
    roles: ["admin"],
  },
  {
    key: "redeem-codes",
    path: "/admin/redeem-codes",
    label: "兑换码后台",
    roles: ["admin"],
  },
  {
    key: "feedback",
    path: "/admin/feedback",
    label: "反馈合作",
    roles: ["admin"],
  },
  {
    key: "question-reports",
    path: "/admin/question-reports",
    label: "题目报告",
    roles: ["admin"],
  },
  {
    key: "question-patches",
    path: "/admin/question-patches",
    label: "题目补丁",
    roles: ["admin"],
  },
  {
    key: "notifications",
    path: "/admin/notifications",
    label: "通知设置",
    roles: ["admin"],
  },
  {
    key: "notification-stats",
    path: "/admin/notification-stats",
    label: "通知统计",
    roles: ["admin"],
  },
  {
    key: "ai-model",
    path: "/admin/ai-model",
    label: "AI 模型",
    roles: ["admin"],
  },
  {
    key: "stats",
    path: "/admin/stats",
    label: "日活统计",
    roles: ["admin"],
  },
];

export function canAccessAdminShell(user: SessionUser): boolean {
  return isAdminUsername(user.username) || Boolean(user.isPromoter);
}

export function getAdminHomePath(user: SessionUser): string {
  if (isAdminUsername(user.username)) return "/admin/users";
  if (user.isPromoter) return "/admin/promoter-cards";
  return "/account";
}

export function getMenuForUser(user: SessionUser): AdminMenuItem[] {
  const isAdmin = isAdminUsername(user.username);
  const isPromoter = Boolean(user.isPromoter);
  return ADMIN_MENU.filter((item) => {
    if (item.roles.includes("admin") && isAdmin) return true;
    if (item.roles.includes("promoter") && isPromoter) return true;
    return false;
  });
}

export function matchAdminMenuKey(
  pathname: string,
  menu: AdminMenuItem[] = ADMIN_MENU,
): string {
  const exact = menu.find((item) => item.path === pathname);
  if (exact) return exact.key;
  const prefix = menu.find(
    (item) => pathname === item.path || pathname.startsWith(`${item.path}/`),
  );
  return prefix?.key ?? menu[0]?.key ?? "users";
}

export function canAccessAdminPath(
  user: SessionUser,
  pathname: string,
): boolean {
  if (pathname === "/admin" || pathname === "/admin/") return true;
  const menu = getMenuForUser(user);
  return menu.some(
    (item) => pathname === item.path || pathname.startsWith(`${item.path}/`),
  );
}
