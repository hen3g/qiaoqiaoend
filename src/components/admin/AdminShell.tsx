"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Button,
  Layout,
  Menu,
  Result,
  Space,
  Typography,
} from "@arco-design/web-react";
import {
  IconCalendar,
  IconDashboard,
  IconExclamationCircle,
  IconFile,
  IconGift,
  IconIdcard,
  IconMenuFold,
  IconMenuUnfold,
  IconMessage,
  IconNotification,
  IconPoweroff,
  IconUser,
  IconUserGroup,
  IconBook,
  IconSettings,
  IconTool,
} from "@arco-design/web-react/icon";
import { useAuth } from "@/components/AuthProvider";
import { AdminGuard } from "@/components/admin/AdminGuard";
import {
  canAccessAdminPath,
  getAdminHomePath,
  getMenuForUser,
  matchAdminMenuKey,
  type AdminMenuItem,
} from "@/components/admin/menu";
import type { SessionUser } from "@/lib/auth";

function renderAdminMenuItems(menu: AdminMenuItem[]) {
  const nodes: React.ReactNode[] = [];
  let i = 0;
  while (i < menu.length) {
    const group = menu[i]!.group;
    if (!group) {
      const item = menu[i]!;
      nodes.push(
        <Menu.Item key={item.key}>
          {MENU_ICONS[item.key]}
          {item.label}
        </Menu.Item>,
      );
      i += 1;
      continue;
    }
    const grouped: AdminMenuItem[] = [];
    while (i < menu.length && menu[i]!.group === group) {
      grouped.push(menu[i]!);
      i += 1;
    }
    nodes.push(
      <Menu.ItemGroup key={`group-${group}`} title={group}>
        {grouped.map((item) => (
          <Menu.Item key={item.key}>
            {MENU_ICONS[item.key]}
            {item.label}
          </Menu.Item>
        ))}
      </Menu.ItemGroup>,
    );
  }
  return nodes;
}

const { Header, Sider, Content } = Layout;

const MENU_ICONS: Record<string, React.ReactNode> = {
  "promoter-cards": <IconIdcard />,
  "promoter-users": <IconUserGroup />,
  "promoter-orders": <IconFile />,
  users: <IconUser />,
  orders: <IconFile />,
  "user-content": <IconBook />,
  "redeem-codes": <IconGift />,
  feedback: <IconMessage />,
  "question-reports": <IconExclamationCircle />,
  "question-patches": <IconTool />,
  notifications: <IconNotification />,
  "notification-stats": <IconDashboard />,
  "ai-model": <IconSettings />,
  stats: <IconCalendar />,
  "hamster-users": <IconUser />,
  "hamster-orders": <IconFile />,
  "hamster-stats": <IconCalendar />,
};

function AdminChrome({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const menu = useMemo(() => getMenuForUser(user), [user]);
  const selectedKey = useMemo(
    () => matchAdminMenuKey(pathname || "/admin", menu),
    [pathname, menu],
  );
  const isHamsterArea = (pathname || "").startsWith("/admin/hamster");
  const allowed = canAccessAdminPath(user, pathname || "/admin");

  useEffect(() => {
    if (!allowed && pathname && pathname !== "/admin") {
      router.replace(getAdminHomePath(user));
    }
  }, [allowed, pathname, router, user]);

  const title =
    menu.find((item) => item.key === selectedKey)?.label ?? "管理后台";

  return (
    <Layout style={{ minHeight: "100vh", background: "var(--color-fill-2)" }}>
      <Sider
        collapsible
        collapsed={collapsed}
        trigger={null}
        width={220}
        style={{
          boxShadow: "2px 0 8px rgba(0,0,0,0.04)",
        }}
      >
        <div
          style={{
            height: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            padding: collapsed ? 0 : "0 20px",
            borderBottom: "1px solid var(--color-border)",
            fontWeight: 600,
            fontSize: collapsed ? 14 : 16,
            color: "var(--color-text-1)",
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          {collapsed
            ? isHamsterArea
              ? "仓"
              : "敲"
            : isHamsterArea
              ? "仓鼠单词后台"
              : "敲敲英语后台"}
        </div>
        <Menu
          selectedKeys={[selectedKey]}
          style={{ width: "100%" }}
          onClickMenuItem={(key) => {
            const item = menu.find((m) => m.key === key);
            if (item) router.push(item.path);
          }}
        >
          {renderAdminMenuItems(menu)}
        </Menu>
      </Sider>
      <Layout>
        <Header
          style={{
            height: 56,
            padding: "0 20px",
            background: "var(--color-bg-2)",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Space>
            <Button
              type="text"
              icon={collapsed ? <IconMenuUnfold /> : <IconMenuFold />}
              onClick={() => setCollapsed((v) => !v)}
            />
            <Typography.Text bold>{title}</Typography.Text>
          </Space>
          <Space>
            <Typography.Text type="secondary">
              {user.nickname || user.username}
            </Typography.Text>
            <Button
              type="text"
              status="danger"
              icon={<IconPoweroff />}
              onClick={() => void logout()}
            >
              退出
            </Button>
          </Space>
        </Header>
        <Content style={{ padding: 20, overflow: "auto" }}>
          {allowed ? (
            children
          ) : (
            <Result
              status="403"
              title="无权限"
              subTitle="当前账号无法访问该页面，正在跳转…"
            />
          )}
        </Content>
      </Layout>
    </Layout>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      {(user) => <AdminChrome user={user}>{children}</AdminChrome>}
    </AdminGuard>
  );
}
