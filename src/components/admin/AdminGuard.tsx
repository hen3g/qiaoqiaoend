"use client";

import Link from "next/link";
import { Button, Result, Spin } from "@arco-design/web-react";
import { useAuth } from "@/components/AuthProvider";
import { canAccessAdminShell } from "@/components/admin/menu";
import type { SessionUser } from "@/lib/auth";

type AdminGuardProps = {
  children: (user: SessionUser) => React.ReactNode;
};

export function AdminGuard({ children }: AdminGuardProps) {
  const { user, status } = useAuth();

  if (status === "loading") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
        }}
      >
        <Spin tip="加载中…" size={32} />
      </div>
    );
  }

  if (!user) {
    return (
      <Result
        status="warning"
        title="未登录"
        subTitle="请先登录后再访问后台。"
        extra={
          <Link href="/login">
            <Button type="primary">去登录</Button>
          </Link>
        }
      />
    );
  }

  if (!canAccessAdminShell(user)) {
    return (
      <Result
        status="403"
        title="无权限"
        subTitle="当前账号无权访问后台。"
        extra={
          <Link href="/account">
            <Button type="secondary">返回账号</Button>
          </Link>
        }
      />
    );
  }

  return <>{children(user)}</>;
}
