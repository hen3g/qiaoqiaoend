"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spin } from "@arco-design/web-react";
import { useAuth } from "@/components/AuthProvider";
import { getAdminHomePath } from "@/components/admin/menu";

export default function AdminIndexPage() {
  const { user, status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status !== "ready" || !user) return;
    router.replace(getAdminHomePath(user));
  }, [status, user, router]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 240,
      }}
    >
      <Spin tip="进入后台…" size={32} />
    </div>
  );
}
