import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import helmet from "helmet";
import { csrfProtection } from "./middleware/csrf.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { authRouter } from "./routes/auth.js";
import { healthRouter } from "./routes/health.js";

export function createApp(): Express {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(express.json({ limit: "10kb" }));
  app.use(cookieParser());
  app.use(csrfProtection);

  app.use("/api", healthRouter);
  app.use("/api", authRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
