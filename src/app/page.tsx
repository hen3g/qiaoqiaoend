import type { Metadata } from "next";
import { CompanyHome } from "@/components/company/CompanyHome";

export const metadata: Metadata = {
  title: {
    absolute: "言词科技（大连）有限公司",
  },
  description:
    "言词科技专注英语学习软件。让学习者亲手把单词和句子敲出来，把“看得懂”变成“用得上”。",
};

export default function HomePage() {
  return <CompanyHome />;
}
