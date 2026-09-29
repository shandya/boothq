import cookieParser from "cookie-parser";
import express, { type Express, type RequestHandler } from "express";
import { createRequire } from "node:module";
import { csrfProtection } from "./middleware/csrf.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { authRouter } from "./routes/auth.js";
import { dayRouter } from "./routes/day.js";
import { daysRouter } from "./routes/days.js";
import { eventsRouter } from "./routes/events.js";
import { healthRouter } from "./routes/health.js";
import { publicRouter } from "./routes/public.js";
import { queueRouter } from "./routes/queue.js";
import { ticketsRouter } from "./routes/tickets.js";

// helmet's package.json `exports` map has no explicit "types" condition, so
// under `moduleResolution: NodeNext` a plain `import helmet from "helmet"`
// resolves to a callable in some environments and a non-callable namespace
// in others (confirmed: this repo's own sandbox vs. Vercel's build disagree
// — see https://github.com/helmetjs/helmet/issues/414). Loading it via
// require() and casting by hand sidesteps that resolution ambiguity.
const require = createRequire(import.meta.url);
const helmet = require("helmet") as () => RequestHandler;

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
  app.use("/api", daysRouter);
  app.use("/api", eventsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

// Vercel's Express/Node builder invokes this file's default export directly
// as the per-request handler (it never calls `server.ts`'s `.listen()`,
// which doesn't apply to serverless invocation). It requires that default
// export to be a callable Express app, so build one warm instance here for
// it — see docs/ARCHITECTURE.md -> "Hosting the API". `createApp` stays
// available as a named export so `server.ts` and tests keep getting a
// fresh app instance.
export default createApp();
