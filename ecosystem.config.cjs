// pm2 本地常驻：先 npm run build:app 打包，再 pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'trading-front',
      cwd: __dirname,
      script: 'node_modules/vite/bin/vite.js',
      args: 'preview --port 4173 --strictPort',
      autorestart: true,
      watch: false,
    },
  ],
};
