import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./config/env.js";
import { identityMiddleware } from "./auth/identity.js";
import { chatRateLimiter } from "./middleware/rateLimiter.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { chatRouter } from "./routes/chat.js";
import { invoicesRouter } from "./routes/invoices.js";
import { healthRouter } from "./routes/health.js";
import { devAuthRouter } from "./routes/dev-auth.js";
import "./openai/tools/index.js"; // registers all tools as a side effect

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// apps/server/src -> apps/widget/dist. Lets a single tunneled/deployed port serve both
// the API and the embeddable widget script, instead of needing two separate origins.
// Populated by `pnpm --filter @mpe-chatbot/widget build`; harmless 404s if absent.
const WIDGET_DIST_DIR = path.resolve(__dirname, "../../widget/dist");

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.CORS_ALLOWED_ORIGINS.length ? env.CORS_ALLOWED_ORIGINS : true,
      credentials: false,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(identityMiddleware);

  app.use(
    "/widget",
    express.static(WIDGET_DIST_DIR, {
      setHeaders: (res) => res.setHeader("Access-Control-Allow-Origin", "*"),
    })
  );

  app.use("/api/health", healthRouter);
  app.use("/api/chat", chatRateLimiter, chatRouter);
  app.use("/api/invoices", invoicesRouter);

  if (env.ENABLE_DEV_AUTH) {
    app.use("/api/dev", devAuthRouter);
  }

  app.use(errorHandler);

  return app;
}
