import { notFound } from "next/navigation";
import { isLocalDevToolsEnabled } from "@/lib/dev-admin";
import { UsersAdmin } from "./UsersAdmin";

export default function AdminUsersPage() {
  if (!isLocalDevToolsEnabled()) {
    notFound();
  }
  return <UsersAdmin />;
}
