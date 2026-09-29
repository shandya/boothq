import { z } from "zod";

// Structural validation only. Phone *format* (a real, dialable number) is
// checked in apps/api/src/lib/phone.ts with libphonenumber-js, because that
// needs the per-booth DEFAULT_COUNTRY and isn't expressible as a static
// zod schema shared with the (country-agnostic) web client.
const phoneSchema = z.string().min(1).max(40);

const nameSchema = z.string().trim().min(1).max(60);
const notesSchema = z.string().max(280);
const pauseReasonSchema = z.string().max(80);

export const loginSchema = z.object({
  role: z.enum(["ADMIN", "ILLUSTRATOR"]),
  pin: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const openDaySchema = z.object({
  headsUpAhead: z.number().int().min(0).max(10).optional(),
});
export type OpenDayInput = z.infer<typeof openDaySchema>;

export const patchDaySchema = z.object({
  acceptingTickets: z.boolean().optional(),
  headsUpAhead: z.number().int().min(0).max(10).optional(),
});
export type PatchDayInput = z.infer<typeof patchDaySchema>;

export const pauseDaySchema = z.object({
  minutes: z.number().int().min(1).max(240).optional(),
  reason: pauseReasonSchema.optional(),
});
export type PauseDayInput = z.infer<typeof pauseDaySchema>;

export const createTicketSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  notes: notesSchema.optional(),
  force: z.boolean().optional(),
});
export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const updateTicketSchema = z.object({
  name: nameSchema.optional(),
  phone: phoneSchema.optional(),
  notes: notesSchema.optional(),
});
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;

export const ticketsQuerySchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(), // comma-separated TicketStatus list
});
export type TicketsQueryInput = z.infer<typeof ticketsQuerySchema>;

export const callNextSchema = z.object({
  expectedNextId: z.string().min(1).optional(),
});
export type CallNextInput = z.infer<typeof callNextSchema>;

export const finishTicketSchema = z.object({
  callNext: z.boolean().optional(),
});
export type FinishTicketInput = z.infer<typeof finishTicketSchema>;

export const requeueTicketSchema = z.object({
  afterCount: z.number().int().min(0).max(50).optional(),
});
export type RequeueTicketInput = z.infer<typeof requeueTicketSchema>;

export const undoSchema = z.object({
  expectedActionId: z.string().min(1).optional(), // UndoDTO.actionId the caller is looking at
});
export type UndoInput = z.infer<typeof undoSchema>;

export const reorderQueueSchema = z.object({
  order: z.array(z.string().min(1)),
});
export type ReorderQueueInput = z.infer<typeof reorderQueueSchema>;

export const startEventSchema = z.object({ name: nameSchema });
export type StartEventInput = z.infer<typeof startEventSchema>;

export const renameEventSchema = z.object({ name: nameSchema });
export type RenameEventInput = z.infer<typeof renameEventSchema>;

export const confirmPhotoSchema = z.object({
  pathname: z.string().min(1).max(200),
});
export type ConfirmPhotoInput = z.infer<typeof confirmPhotoSchema>;
