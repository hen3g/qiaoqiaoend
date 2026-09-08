import type { Metadata } from "next";
import { DeleteAccountPage } from "./DeleteAccountPage";

export const metadata: Metadata = {
  title: "Delete account",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <DeleteAccountPage />;
}
