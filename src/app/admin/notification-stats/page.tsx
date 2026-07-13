import { notFound } from "next/navigation";
import { isLocalDevToolsEnabled } from "@/lib/dev-admin";
import { NotificationStatsAdmin } from "./NotificationStatsAdmin";

export default function AdminNotificationStatsPage() {
  if (!isLocalDevToolsEnabled()) {
    notFound();
  }
  return <NotificationStatsAdmin />;
}
