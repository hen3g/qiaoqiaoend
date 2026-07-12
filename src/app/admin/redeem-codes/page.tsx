import { notFound } from "next/navigation";
import { isLocalDevToolsEnabled } from "@/lib/dev-admin";
import { RedeemCodesAdmin } from "./RedeemCodesAdmin";

export default function AdminRedeemCodesPage() {
  if (!isLocalDevToolsEnabled()) {
    notFound();
  }
  return <RedeemCodesAdmin />;
}
