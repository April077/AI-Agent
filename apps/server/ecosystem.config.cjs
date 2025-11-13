module.exports = {
  apps: [
    {
      name: "api",
      script: "/app/apps/server/dist/index.js",  // ✅ Absolute path
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      env: {
        NODE_ENV: "production",
        PORT: 4000
      }
    },
    {
      name: "cron",
      script: "/app/apps/server/dist/cron/emailFetcher.js",  // ✅ Absolute path
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      env: {
        NODE_ENV: "production"
      }
    },
    {
      name: "worker",
      script: "/app/apps/server/dist/worker/aiProcessor.js",  // ✅ Absolute path
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};