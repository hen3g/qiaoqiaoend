# 宝贝英语官网

Next.js 官方网站：注册 / 登录 / 修改密码、客户端下载、课程下载、兑换码。

## 本地运行

```bash
cp .env.example .env.local
# 填写数据库与 AUTH_SECRET
npm install
npm run dev
```

打开 [http://localhost:4891](http://localhost:4891)。

## 功能

| 页面 | 说明 |
|------|------|
| `/register` | 注册（用户名 + 密码 + Cap 人机验证） |
| `/login` | 登录（用户名 + 密码 + Cap 人机验证） |
| `/change-password` | 修改密码（需登录） |
| `/#download` | 客户端下载（首页区块） |
| `/courses` | 课程包下载 |
| `/redeem` | 兑换码（延长会员 / 永久会员） |
| `/account` | 账号信息 |
| `/admin/redeem-codes` | 本地开发专用：生成会员兑换码（仅 `channg`，`next build` 后不可用） |
| `/admin/notifications` | 本地开发专用：发布通知（仅 `channg`，`next build` 后不可用） |

公开接口：`GET /api/notifications` 返回各类型最新通知（更新 / 消息），最多 2 条。

## 数据库

远程 MySQL，表：`users`、`course_categories`、`courses`、`user_courses`、`redeem_codes`、`redeem_logs`、`app_releases`、`notifications`、`cap_challenges`、`cap_tokens`。

课程按分类展示（启蒙 / 小学 / 初中 / 高中 / 场景 / 功能 / 名词 / 兴趣 / 考试 / 专业）。`courses.download_url` 指向 Cloudflare R2 上的 zip 课程包。

### 同步课程到 R2 + 数据库

```bash
# 上传 zip 并写入/更新分类与课程元数据
npm run sync:courses

# 仅更新数据库（不重新上传）
npm run sync:courses:db
```

客户端安装包 URL 在 `app_releases` 表中维护；当前为占位链接，上线前请替换为真实下载地址。
