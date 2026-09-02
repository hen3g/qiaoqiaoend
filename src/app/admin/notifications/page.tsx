import { Suspense } from "react";
import { NotificationsAdmin } from "./NotificationsAdmin";

export default function AdminNotificationsPage() {
  return (
    <Suspense fallback={null}>
      <NotificationsAdmin />
    </Suspense>
  );
}
