import { Suspense } from "react";
import { NotificationsAdmin } from "./NotificationsAdmin";

export default function AdminQiaoqiaoNotificationsPage() {
  return (
    <Suspense fallback={null}>
      <NotificationsAdmin app="qiaoqiao" />
    </Suspense>
  );
}
