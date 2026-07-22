/**
 * This is a PM2 configuration file.
 *
 * References:
 * - https://pm2.keymetrics.io/docs/usage/application-declaration/
 * - https://pm2.keymetrics.io/docs/usage/environment/
 */

const path = require("path")

const serverCwd = path.join(__dirname, "webapp", "server")

module.exports = {
  apps: [
    {
      name: "appserver",
      script: "server.js",
      instances: 4,
      exec_mode: "cluster",
      cwd: serverCwd,
      node_args: "--max_old_space_size=1024",
      max_memory_restart: "1200M"
    },
    {
      name: "cronserver",
      script: "cronServer.js",
      cwd: serverCwd,
      node_args: "--max_old_space_size=1024",
      max_memory_restart: "1200M"
    }
  ]
}
