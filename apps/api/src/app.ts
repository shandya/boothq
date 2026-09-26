import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import helmet from "helmet";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { healthRouter } from "./routes/health.js";

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(express.json({ limit: "10kb" }));
  app.use(cookieParser());

  app.use("/api", healthRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
