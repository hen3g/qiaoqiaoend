/**
 * PM2 ecosystem for qiaoqiaoend (Next.js 14)
 *
 * 首次部署:
 *   npm ci && npm run build
 *   pm2 start ecosystem.config.cjs
 *
 * 日常:
 *   pm2 reload ecosystem.config.cjs
 *   pm2 save && pm2 startup
 */
module.exports = {
  apps: [
    {
      name: "qiaoqiaoend",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start -p 4891",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 4891,
      },
      error_file: "logs/pm2-error.log",
      out_file: "logs/pm2-out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
