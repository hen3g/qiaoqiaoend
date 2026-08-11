import "@arco-design/web-react/dist/css/arco.css";
import { AdminLayoutClient } from "@/components/admin/AdminLayoutClient";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
