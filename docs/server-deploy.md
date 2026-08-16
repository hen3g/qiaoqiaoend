# 服务端部署

线上站点：https://www.word19.com  
支付回调域名：https://qiaoqiaoengapp.word19.com  
应用目录：`/www/wwwroot/qiaoqiaoend`  
进程：PM2 应用名 `qiaoqiaoend`，监听 `127.0.0.1:4891`  
仓库：`git@github.com:hen3g/qiaoqiaoend.git`（分支 `main`）

日常发布就是四步：**本机提交并 push → 服务器 pull → build → 重启 PM2**。只拉代码不 build，PM2 会继续跑旧构建，或直接因缺少 `.next` 而崩溃。

## 本机：提交并推送

```bash
cd /path/to/qiaoqiaoend
git status
git add -A
git commit -m "说明这次改了什么"
git push origin main
```

不要把 `.env` / `.env.local` 提交进仓库（已在 `.gitignore`）。密钥只放服务器上的 `.env.local`。

## 服务器：拉取、构建、重启

SSH 登录后：

```bash
cd /www/wwwroot/qiaoqiaoend
git pull origin main

# package-lock.json 有变化时再装依赖
npm ci

npm run build
pm2 restart qiaoqiaoend
```

构建大约 1–2 分钟。成功后应能看到 `.next/BUILD_ID`。

可选：确认进程与本机探测：

```bash
pm2 list
sleep 2
curl -s -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:4891/
```

`pm2 list` 应为 `online`，本机探测应为 `HTTP 200`。

若页面刷新仍是旧版、站内跳转却是新版，清一次 nginx HTML 缓存（见 [nginx-html-cache.md](./nginx-html-cache.md)）：

```bash
rm -rf /www/server/nginx/proxy_cache_dir/*
nginx -s reload
```

## 环境变量

Next.js 生产环境会自动读取项目根目录的 `.env.local`。服务器上这份文件**不要从 git 拉**，首次部署时从本机拷一份，或对照 `.env.example` 手写。

最低需要：

| 变量 | 用途 |
|------|------|
| `DATABASE_*` | MySQL |
| `AUTH_SECRET` | 登录 / OAuth 签名 |
| `OAUTH_CLIENT_ID` / `OAUTH_REDIRECT_URIS` | 客户端登录回调 |
| `ALIPAY_*` | APP 支付与异步通知 |
| （无需密钥）Apple IAP | App Store Connect 服务器通知填 `https://qiaoqiaoengapp.word19.com/api/iap/apple/notify`（生产与沙盒同一地址） |
| `R2_*` | 课程包存储 |
| `AI_PROVIDER` 及对应 Token | 自制课程 AI |
| `SECRET_ID` / `SECRET_KEY` / `TENCENT_SES_*` | 邮箱验证码 |

改完 `.env.local` 后必须 `pm2 restart qiaoqiaoend` 才会生效。`ALLOW_TEST_VIP_PURCHASE` 生产环境不要设为 `1`。

## PM2

配置文件：仓库根目录 `ecosystem.config.cjs`。

```bash
# 首次（还没有这个进程时）
mkdir -p logs
npm ci && npm run build
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # 按提示执行，开机自启

# 日常更新后
pm2 restart qiaoqiaoend

# 看日志
pm2 logs qiaoqiaoend --lines 80
# 或
tail -n 80 logs/pm2-error.log logs/pm2-out.log
```

用 `restart` 即可。配置文件本身改过时再用：

```bash
pm2 delete qiaoqiaoend
pm2 start ecosystem.config.cjs
pm2 save
```

## 首次把仓库放到服务器

若目录还不存在：

```bash
cd /www/wwwroot
git clone git@github.com:hen3g/qiaoqiaoend.git
cd qiaoqiaoend
# 放入 .env.local（从本机 scp，或对照 .env.example 填写）
npm ci
npm run build
mkdir -p logs
pm2 start ecosystem.config.cjs
pm2 save
```

服务器需要能访问 GitHub（SSH key 或 deploy key）。宝塔若用 `www` 跑 Node，构建和启动用同一用户，避免 `.next` 权限错乱：

```bash
chown -R www:www /www/wwwroot/qiaoqiaoend
```

当前这台机是 root + PM2，按上面日常命令即可。

## 反向代理

Nginx（宝塔）把 `www.word19.com` / `qiaoqiaoengapp.word19.com` 反代到 `http://127.0.0.1:4891`。支付宝通知、应用网关、Apple IAP 通知必须走公网 HTTPS，不要只反代到本机 IP。

## 常见问题

| 现象 | 处理 |
|------|------|
| PM2 `errored`，日志 `Could not find a production build in the '.next' directory` | 漏了 `npm run build`。拉代码后必须构建再重启 |
| `EACCES` / `entryCSSFiles` undefined | `.next` 权限或产物不完整。删掉 `.next` 后用同一用户重新 `npm run build` |
| 接口已是新版，刷新页面仍是旧 UI | nginx 缓存了 HTML，见 [nginx-html-cache.md](./nginx-html-cache.md) |
| 改了环境变量不生效 | `pm2 restart qiaoqiaoend`（进程启动时读 `.env.local`） |
| `git pull` 提示本地改过 | 服务器上不要改业务代码。确认无有效改动后 `git checkout -- . && git pull` |

## 相关文件

| 项 | 路径 |
|----|------|
| PM2 配置 | `ecosystem.config.cjs` |
| 环境变量模板 | `.env.example` |
| 服务器项目目录 | `/www/wwwroot/qiaoqiaoend` |
| PM2 日志 | `logs/pm2-error.log`、`logs/pm2-out.log` |
| nginx 缓存说明 | [nginx-html-cache.md](./nginx-html-cache.md) |
