module.exports = {
  apps: [
    {
      name: "mentora-docker",
      script: "docker",
      args: ["compose", "-f", "docker-compose.prod.yml", "up"],
      interpreter: "none",
      cwd: __dirname,
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 20,
      // "up" streams container logs to stdout/stderr for as long as the
      // stack is running — pm2 captures that the same way it would any
      // other long-running process.
    },
  ],
};
