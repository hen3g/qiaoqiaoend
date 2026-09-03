import { redirect } from "next/navigation";

export default function AdminHamsterIndexPage() {
  redirect("/admin/hamster/users");
}
