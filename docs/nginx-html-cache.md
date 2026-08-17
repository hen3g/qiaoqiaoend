# 部署后页面仍是旧版：nginx HTML 缓存

记录一次线上故障：`/account` 已部署新代码，但刷新仍显示旧页面；从其他页点链接进入却是新页面。

## 现象

- 代码已 push、服务已重启，接口（如 `/api/promo/submissions`）已是新版
- 从 `/admin/promo` 等页面点击顶栏用户名进入 `/account` → **新 UI**
- 在 `/account` 按 F5 刷新 → **旧 UI**
- 路由相同，表现不一致

下载链接、课程等「像立刻生效」的更新，往往走的是 **API + 数据库**，不依赖这份被缓存的 HTML，所以容易误判成「只有 account 没部署」。

## 原因

1. Next.js 对预渲染页面会返回类似：

   ```http
   Cache-Control: s-maxage=31536000
   ```

   （约一年，给 CDN / 反向代理用的共享缓存）

2. 宝塔 nginx 开启了 `proxy_cache`，会按该头把 **整页 HTML** 存起来：

   ```nginx
   # /www/server/nginx/conf/proxy.conf
   proxy_cache_path /www/server/nginx/proxy_cache_dir levels=1:2 keys_zone=cache_one:20m inactive=1d max_size=5g;
   ```

3. 重新部署后 Node 进程里已是新构建，但 nginx 仍可能继续返回 **部署前的 HTML**。

4. 旧 HTML 引用 **旧的** `/_next/static/chunks/*.js`（内容 hash）。这些带 hash 的旧文件往往还在，旧 UI 仍能完整运行。

### 为何「软跳转新、刷新旧」

| 操作 | 实际路径 | 结果 |
|------|----------|------|
| 站内 `<Link>` 点击 | 客户端软跳转，用当前已加载的新版 JS 渲染目标页 | 新页面 |
| F5 / 地址栏进页 | 重新请求 HTML，命中 nginx 旧缓存 | 旧页面 |

可用响应头确认：

```bash
curl -sI https://qiaoqiaoengapp.word19.com/account | egrep -i 'cache-control|x-cache|x-nextjs-cache|etag'
```

出问题时常见：`x-cache: HIT`，且 `s-maxage` 很大。

## 处理（当时）

在服务器上：

```bash
# 拉代码、构建、重启 Node（pm2 / systemd 等，按实际）
git pull
npm run build
# pm2 restart <app> …

# 清空 nginx 代理缓存（路径以 proxy.conf 为准）
rm -rf /www/server/nginx/proxy_cache_dir/*
nginx -s reload
# 宝塔也可用：/etc/init.d/nginx reload
```

然后用无痕窗口或强制刷新验证。

## 代码侧已做的防护

避免 HTML 再被长期共享缓存（静态资源 `/_next/static` 仍可 immutable）：

- 根布局：`export const dynamic = "force-dynamic"`
- `/account` layout：同样 `force-dynamic` + `revalidate = 0`
- `src/middleware.ts`：对页面响应设置 `Cache-Control: private, no-cache, no-store, …`
- `next.config.ts`：对页面路径补充同样的 `Cache-Control`（排除 `_next/static` 等）

构建后路由应为动态（`ƒ`），而不再是整站静态预渲染壳。

## 以后部署建议

1. `git pull` → `npm run build` → 重启 Node  
2. **清一次** `/www/server/nginx/proxy_cache_dir/*` 并 `nginx -s reload`（尤其刚改过缓存策略、或怀疑页面仍旧时）  
3. 无痕窗口抽查关键页（`/`、`/account`）  
4. 若再次出现「点链接新、刷新旧」，优先查 nginx HTML 缓存，而不是怀疑路由写错

## 相关路径（本机 / 服务器）

| 项 | 路径 |
|----|------|
| nginx 缓存配置 | `/www/server/nginx/conf/proxy.conf` |
| 缓存目录 | `/www/server/nginx/proxy_cache_dir` |
| 线上站点 | https://qiaoqiaoengapp.word19.com |
