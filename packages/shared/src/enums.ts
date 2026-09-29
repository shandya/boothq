export const DayStatus = {
  OPEN: "OPEN",
  CLOSED: "CLOSED",
} as const;
export type DayStatus = (typeof DayStatus)[keyof typeof DayStatus];

export const TicketStatus = {
  WAITING: "WAITING",
  CALLED: "CALLED",
  SERVING: "SERVING",
  READY: "READY",
  DONE: "DONE",
  NO_SHOW: "NO_SHOW",
  CANCELLED: "CANCELLED",
} as const;
export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

export const TicketMode = {
  IN_PERSON: "IN_PERSON",
  FROM_PHOTO: "FROM_PHOTO",
} as const;
export type TicketMode = (typeof TicketMode)[keyof typeof TicketMode];

export const CancelReason = {
  CUSTOMER: "CUSTOMER",
  ADMIN_REMOVED: "ADMIN_REMOVED",
  DAY_CLOSED: "DAY_CLOSED",
} as const;
export type CancelReason = (typeof CancelReason)[keyof typeof CancelReason];

export const Role = {
  ADMIN: "ADMIN",
  ILLUSTRATOR: "ILLUSTRATOR",
  CUSTOMER: "CUSTOMER",
  SYSTEM: "SYSTEM",
} as const;
export type Role = (typeof Role)[keyof typeof Role];
