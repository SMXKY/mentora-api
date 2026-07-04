import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import basicAuth from "express-basic-auth";
import path from "path";

import { requestId } from "./middlewares/requestId.middleware";
import { resolveLocale } from "./shared/i18n/resolveLocale";
import { globalErrorController } from "./utils/error.controller";
import { AppError } from "./utils/AppError.util";
import { CORS_ORIGINS } from "./utils/enviromentVariablesCheck.util";
import { StatusCodes } from "http-status-codes";
import roleRouter from "./modules/role";
import authRouter from "./modules/auth";
import permissionRouter from "./modules/permission";
import permissionOverideRouter from "./modules/permissionOverride";
import userRouter from "./modules/user";
import auditLogRouter from "./modules/auditLog";

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

export const app = express();
app.set("trust proxy", true);
app.use(helmet());

const allowedOrigins = (CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
      "X-Request-ID",
      "X-Lang",
      "Accept-Language",
    ],
  })
);

app.use(requestId);
app.use(resolveLocale());

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

app.get("/health", (req: Request, res: Response) => {
  res.status(StatusCodes.OK).json({
    success: true,
    data: {
      status: "healthy",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
    },
  });
});

try {
  const spec = require("../docs/api/openapi.json");

  app.use(
    "/api/docs",
    basicAuth({
      users: {
        [process.env.DOCS_USERNAME || "mentora"]:
          process.env.DOCS_PASSWORD || "changeme",
      },
      challenge: true,
      realm: "MENTORA API Docs",
    }),
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customSiteTitle: "MENTORA API",
      swaggerOptions: {
        persistAuthorization: true,
      },
    })
  );

  app.get(
    "/api/docs.json",
    basicAuth({
      users: {
        [process.env.DOCS_USERNAME || "mentora"]:
          process.env.DOCS_PASSWORD || "changeme",
      },
      challenge: true,
    }),
    (req: Request, res: Response) => {
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=mentora-openapi.json"
      );
      res.json(spec);
    }
  );

  console.log("API docs available at /api/docs");
} catch {
  console.log(
    "No OpenAPI spec found. Run: npm run docs:build to generate docs."
  );
}

app.use("/api/v1/roles", roleRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/permissions", permissionRouter);
app.use("/api/v1/permission-overrides", permissionOverideRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/audit-logs", auditLogRouter);

app.use((req: Request, res: Response, next: NextFunction) => {
  next(
    new AppError("common/errors:notFound", StatusCodes.NOT_FOUND, {
      method: req.method,
      path: req.originalUrl,
    })
  );
});

app.use(globalErrorController);
