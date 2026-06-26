// PM2 配置文件
// 用法：在 server 目录下执行  pm2 start ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'calorie-server',
      script: 'dist/main.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      // 日志
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
  ],
};
