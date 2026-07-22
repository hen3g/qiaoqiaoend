# 宝贝英语官网

Next.js 官方网站：注册 / 登录 / 修改密码、在线练习入口、兑换码。

## 本地运行

```bash
cp .env.example .env.local
# 填写数据库与 AUTH_SECRET
npm install
npm run dev
```

打开 [http://localhost:4891](http://localhost:4891)。

部署后若页面刷新仍是旧版、站内跳转却是新版，见 [docs/nginx-html-cache.md](docs/nginx-html-cache.md)（nginx 缓存 HTML）。

## 功能

| 页面 | 说明 |
|------|------|
| `/register` | 注册（用户名 + 密码 + Cap 人机验证） |
| `/login` | 登录（用户名 + 密码 + Cap 人机验证） |
| `/change-password` | 修改密码（需登录） |
| `/courses` | 课程包下载 |
| `/redeem` | 兑换码（延长会员 / 永久会员） |
| `/account` | 账号信息、宣传短视频投稿 |
| `/admin/promo` | 宣传投稿审核与发放会员（仅 `channg`，生产环境可用） |
| `/admin/redeem-codes` | 本地开发专用：生成会员兑换码（仅 `channg`，`next build` 后不可用） |
| `/admin/notifications` | 本地开发专用：发布通知（仅 `channg`，`next build` 后不可用） |
| `/admin/notification-stats` | 本地开发专用：通知接口调用量 / 日活估算（仅 `channg`，`next build` 后不可用） |
| `/admin/users` | 本地开发专用：查看全部用户信息（仅 `channg`，`next build` 后不可用） |

公开接口：`GET /api/notifications` 返回各类型最新通知（更新 / 消息），最多 2 条；每次调用会计入统计。带 `Authorization: Bearer`（OAuth）或网站登录 Cookie 时，还会按用户 ID 去重统计日活。可通过 `?source=web` 标记在线版请求（缺省按客户端）；`/admin/users` 据此展示用户用过客户端、在线版或两者。

### 宣传有礼

用户在 `/account` 提交短视频链接（可选点赞数、备注）。管理员用 `channg` 登录后打开 `/admin/promo` 查看全部投稿，按点赞数发放会员（每 1 个赞对应 1 个月，按 30 天计）或驳回；已发放会标记状态。

也可加微信 `535938559` 沟通发放。

## 数据库

远程 MySQL，表：`users`、`course_categories`、`courses`、`user_courses`、`redeem_codes`、`redeem_logs`、`notifications`、`promo_submissions`、`notification_api_daily_stats`、`notification_api_daily_users`、`cap_challenges`、`cap_tokens`。

宣传投稿表见 `scripts/schema-promo-submissions.sql`；通知接口统计表见 `scripts/schema-notification-api-stats.sql`；首次访问相关接口时也会自动建表。

课程按分类展示（启蒙 / 小学 / 初中 / 高中 / 场景 / 功能 / 名词 / 兴趣 / 考试 / 专业）。`courses.download_url` 指向 Cloudflare R2 上的 zip 课程包。

### 同步课程到 R2 + 数据库

```bash
# 上传 zip 并写入/更新分类与课程元数据
npm run sync:courses

# 仅更新数据库（不重新上传）
npm run sync:courses:db
```
