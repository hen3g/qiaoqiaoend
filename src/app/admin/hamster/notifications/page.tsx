import { Suspense } from "react";
import { NotificationsAdmin } from "../../notifications/NotificationsAdmin";

export default function AdminHamsterNotificationsPage() {
  return (
    <Suspense fallback={null}>
      <NotificationsAdmin app="hamster" />
    </Suspense>
  );
}
