// PM2 process definitions for production.
//
// Runs the two Node processes this app needs:
//   - fitness-frontend: Next.js (`next start`) on port 3000 — the only one exposed
//     publicly (via the CloudPanel/nginx reverse proxy).
//   - fitness-backend:  Express API on port 4000 — internal only; the frontend
//     proxies /backend/* to it (see next.config.mjs rewrites).
//
// Usage from the repo root:
//   pm2 start ecosystem.config.js
//   pm2 save && pm2 startup   # survive reboots
//
// Env files are still read by each process: the frontend uses .env.local, the
// backend uses backend/.env. The PORT values below just pin the listen ports.
const path = require("path")

module.exports = {
  apps: [
    {
      name: "fitness-frontend",
      cwd: __dirname,
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      max_memory_restart: "600M",
    },
    {
      name: "fitness-backend",
      cwd: path.join(__dirname, "backend"),
      script: "dist/index.js",
      env: {
        NODE_ENV: "production",
        PORT: "4000",
      },
      max_memory_restart: "500M",
    },
  ],
}
