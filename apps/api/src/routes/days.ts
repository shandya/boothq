import { daysQuerySchema } from "@boothq/shared";
import { Router } from "express";
import { requireRole } from "../middleware/auth.js";
import { buildDayCsv, listDayHistory } from "../services/history.service.js";
import { paramString, staffHandler } from "./util.js";

export const daysRouter = Router();

// Admin only: history rows and the export contain customers' phone numbers.
daysRouter.get(
  "/days",
  requireRole("ADMIN"),
  staffHandler(async (req, res) => {
    const { limit } = daysQuerySchema.parse(req.query);
    res.set("Cache-Control", "no-store");
    res.json({ days: await listDayHistory(limit) });
  }),
);

daysRouter.get(
  "/days/:id/export.csv",
  requireRole("ADMIN"),
  staffHandler(async (req, res) => {
    const { filename, body } = await buildDayCsv(paramString(req.params.id));
    res.set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    });
    res.send(body);
  }),
);
