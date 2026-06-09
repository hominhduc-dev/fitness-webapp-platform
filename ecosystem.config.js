// PM2 process definitions for production.
//
// Runs the backend API process used by the backend.hominhduc.me deployment.
//
// Usage from the repo root:
//   pm2 start ecosystem.config.js
//   pm2 save && pm2 startup   # survive reboots
//
// Env files are still read from backend/.env because the process cwd is backend/.
// The values below pin production runtime defaults and override stale PM2 env.
const path = require("path")

module.exports = {
  apps: [
    {
      name: "yeahbuddy",
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
