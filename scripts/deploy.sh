#!/usr/bin/env bash
# 本机一键部署到线上。用法：
#   ./scripts/deploy.sh
#   ./scripts/deploy.sh "这次改了什么"
# 有未提交改动时会先提交再推送。提交说明省略时用「部署」。
# 服务器 SSH 密码读 .env.local 里的 password=，不会打印。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BRANCH="main"
MSG="${1:-部署}"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "当前目录不是 git 仓库" >&2
  exit 1
fi

current="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$current" != "$BRANCH" ]]; then
  echo "当前分支是 $current，请先切到 $BRANCH" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  git add -A
  git commit -m "$MSG"
fi

git push origin "$BRANCH"
echo "已推送 $(git log -1 --oneline)"

if [[ ! -f .env.local ]]; then
  echo "缺少 .env.local，无法读取服务器密码" >&2
  exit 1
fi

SSH_PASSWORD="$(python3 -c '
from pathlib import Path
for line in Path(".env.local").read_text().splitlines():
    if line.startswith("password="):
        print(line.split("=", 1)[1].strip(), end="")
        break
')"
if [[ -z "$SSH_PASSWORD" ]]; then
  echo ".env.local 里没有 password=" >&2
  exit 1
fi

remote="$(cat <<'REMOTE'
set -euo pipefail
export GIT_PAGER=cat PAGER=cat
cd /www/wwwroot/qiaoqiaoend
echo "=== BEFORE ==="
git log -1 --oneline
git status -sb
before="$(git rev-parse HEAD)"
echo "=== PULL ==="
git pull origin main
after="$(git rev-parse HEAD)"
echo "=== HEAD ==="
git log -1 --oneline
if [[ "$before" != "$after" ]] && git diff --name-only "$before" "$after" -- package-lock.json package.json | grep -q .; then
  echo "=== NPM CI ==="
  npm ci
fi
echo "=== BUILD ==="
npm run build
echo "=== RESTART ==="
pm2 restart qiaoqiaoend
sleep 2
pm2 list
echo "=== HEALTH ==="
curl -s -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:4891/
echo "=== BUILD_ID ==="
cat .next/BUILD_ID
echo
REMOTE
)"
export DEPLOY_B64="$(printf '%s' "$remote" | base64 | tr -d '\n')"

export SSH_PASSWORD
expect <<'EOF'
set timeout 600
log_user 1
set password $env(SSH_PASSWORD)
set b64 $env(DEPLOY_B64)
spawn ssh -o StrictHostKeyChecking=no -tt root@182.254.140.32 bash -lc "echo $b64 | base64 -d | bash"
expect {
  "password:" { send "$password\r" }
  "Password:" { send "$password\r" }
}
expect eof
catch wait result
exit [lindex $result 3]
EOF
