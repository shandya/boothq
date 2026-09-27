import { Router } from "express";
import { publicTicketRateLimit } from "../middleware/rate-limit.js";
import { cancelTicketByToken } from "../services/queue.service.js";
import { buildNowServingView, buildPublicTicketView } from "../services/snapshot.service.js";
import { asyncHandler, paramString } from "./util.js";

export const publicRouter = Router();

publicRouter.get(
  "/public/tickets/:token",
  publicTicketRateLimit,
  asyncHandler(async (req, res) => {
    const view = await buildPublicTicketView(paramString(req.params.token));
    res.set("Cache-Control", "no-store");
    res.json(view);
  }),
);

publicRouter.post(
  "/public/tickets/:token/cancel",
  publicTicketRateLimit,
  asyncHandler(async (req, res) => {
    const token = paramString(req.params.token);
    await cancelTicketByToken(token);
    const view = await buildPublicTicketView(token);
    res.set("Cache-Control", "no-store");
    res.json(view);
  }),
);

publicRouter.get(
  "/public/now-serving",
  asyncHandler(async (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json(await buildNowServingView());
  }),
);
