import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import helmet from "helmet";
import { csrfProtection } from "./middleware/csrf.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { authRouter } from "./routes/auth.js";
import { dayRouter } from "./routes/day.js";
import { healthRouter } from "./routes/health.js";
import { publicRouter } from "./routes/public.js";
import { queueRouter } from "./routes/queue.js";
import { ticketsRouter } from "./routes/tickets.js";

export function createApp(): Express {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(express.json({ limit: "10kb" }));
  app.use(cookieParser());
  app.use(csrfProtection);

  app.use("/api", healthRouter);
  app.use("/api", authRouter);
  app.use("/api", publicRouter);
  app.use("/api", queueRouter);
  app.use("/api", ticketsRouter);
  app.use("/api", dayRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
