"use client";

import { ConfigProvider } from "@arco-design/web-react";
import zhCN from "@arco-design/web-react/es/locale/zh-CN";
import { AdminShell } from "@/components/admin/AdminShell";

export function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider locale={zhCN}>
      <AdminShell>{children}</AdminShell>
    </ConfigProvider>
  );
}
