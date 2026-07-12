import { notFound } from "next/navigation";
import { isLocalDevToolsEnabled } from "@/lib/dev-admin";
import { NotificationsAdmin } from "./NotificationsAdmin";

export default function AdminNotificationsPage() {
  if (!isLocalDevToolsEnabled()) {
    notFound();
  }
  return <NotificationsAdmin />;
}
