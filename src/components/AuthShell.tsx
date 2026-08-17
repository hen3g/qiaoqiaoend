import { CompanyShell } from "@/components/company/CompanyShell";
import styles from "@/components/company/company.module.css";

export function AuthShell({
  children,
  asideTitle,
  asideText,
}: {
  children: React.ReactNode;
  asideTitle: string;
  asideText: string;
}) {
  return (
    <CompanyShell>
      <div className={styles["auth-layout"]}>
        <div className={styles["auth-card"]}>
          <aside className={styles["auth-aside"]}>
            <div>
              <p className={styles["auth-aside__brand"]}>言词科技</p>
              <h1>{asideTitle}</h1>
              <p>{asideText}</p>
            </div>
            <p className={styles["auth-aside__tag"]}>用键盘敲句子，学英语。</p>
          </aside>
          <div className={styles["auth-body"]}>{children}</div>
        </div>
      </div>
    </CompanyShell>
  );
}
