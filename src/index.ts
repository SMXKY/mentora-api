import "dotenv/config";
import { createServer } from "http";

import "./utils/enviromentVariablesCheck.util";

import { app } from "./app";
import prisma from "./config/database.config";
import { loadTranslations } from "./utils/translate.util";

process.on("uncaughtException", (err: Error) => {
  console.error({
    event: "uncaught_exception",
    error: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

const port = Number(process.env.PORT) || 3000;

async function bootstrap() {
  await prisma.$connect();
  console.log("Database connected. ✅");

  await loadTranslations();
  console.log("Translations loaded. ✅");

  const httpServer = createServer(app);

  // ============================================================
  // SOCKET.IO
  // Initialised after the HTTP server is created.
  // Uncomment when socket module is implemented.
  // ============================================================
  // const io = initializeSocketIO(httpServer)

  // ============================================================
  // BACKGROUND JOBS
  // Initialised after database connection is confirmed.
  // Uncomment when jobs module is implemented.
  // ============================================================
  // await initJobQueue()
  // console.log('Background jobs initialised. ✅')

  httpServer.listen(port, () => {
    console.log(`Server running on port ${port} ✅`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Health check: http://localhost:${port}/health`);
    console.log(`API docs: http://localhost:${port}/api/docs`);
  });

  return httpServer;
}

const shutdown = async (httpServer: any) => {
  console.log("Shutting down gracefully...");

  httpServer.close(async () => {
    await prisma.$disconnect();
    console.log("Database disconnected. Goodbye.");
    process.exit(0);
  });

  setTimeout(() => {
    console.error("Forced shutdown after timeout.");
    process.exit(1);
  }, 10000);
};

process.on("unhandledRejection", (err: any) => {
  console.error({
    event: "unhandled_rejection",
    error: err?.message || String(err),
    stack: err?.stack,
  });
  process.exit(1);
});

bootstrap()
  .then((httpServer) => {
    process.on("SIGTERM", () => shutdown(httpServer));
    process.on("SIGINT", () => shutdown(httpServer));
  })
  .catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
