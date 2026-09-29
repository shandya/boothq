import type {
  CreateTicketInput,
  EventDTO,
  EventSummaryDTO,
  FinishTicketInput,
  LoginInput,
  OpenDayInput,
  PatchDayInput,
  PauseDayInput,
  PublicTicketView,
  QueueSnapshot,
  RenameEventInput,
  ReorderQueueInput,
  RequeueTicketInput,
  StartEventInput,
  StatsDTO,
  TicketDTO,
} from "@boothq/shared";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type ErrorBody = { error?: { code?: string; message?: string; details?: Record<string, unknown> } };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  const body: unknown = res.status === 204 ? null : await res.json().catch(() => null);

  if (!res.ok) {
    const error = (body as ErrorBody | null)?.error;
    throw new ApiError(
      res.status,
      error?.code ?? "UNKNOWN_ERROR",
      error?.message ?? "Something went wrong.",
      error?.details,
    );
  }

  return body as T;
}

const get = <T>(path: string): Promise<T> => request<T>(path, { method: "GET" });
const post = <T>(path: string, body: unknown = {}): Promise<T> =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });
const patch = <T>(path: string, body: unknown = {}): Promise<T> =>
  request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
const del = <T>(path: string): Promise<T> => request<T>(path, { method: "DELETE" });

// Auth
export const login = (input: LoginInput) => post<{ role: "ADMIN" | "ILLUSTRATOR" }>("/auth/login", input);
export const logout = () => post<{ ok: true }>("/auth/logout");
export const me = () => get<{ role: "ADMIN" | "ILLUSTRATOR" }>("/auth/me");

// Queue (staff)
export const getQueue = () => get<QueueSnapshot>("/queue");
export const callNext = (expectedNextId?: string) => post<QueueSnapshot>("/queue/call-next", { expectedNextId });
export const undoLastAction = (expectedActionId?: string) =>
  post<QueueSnapshot>("/queue/undo", { expectedActionId });
export const reorderQueue = (input: ReorderQueueInput) => post<QueueSnapshot>("/queue/reorder", input);

export const startTicket = (id: string) => post<QueueSnapshot>(`/tickets/${encodeURIComponent(id)}/start`);
export const finishTicket = (id: string, input: FinishTicketInput = {}) =>
  post<QueueSnapshot>(`/tickets/${encodeURIComponent(id)}/finish`, input);
export const recallTicket = (id: string) => post<QueueSnapshot>(`/tickets/${encodeURIComponent(id)}/recall`);
export const noShowTicket = (id: string) => post<QueueSnapshot>(`/tickets/${encodeURIComponent(id)}/no-show`);
export const requeueTicket = (id: string, input: RequeueTicketInput = {}) =>
  post<QueueSnapshot>(`/tickets/${encodeURIComponent(id)}/requeue`, input);

export const pauseDay = (input: PauseDayInput = {}) => post<QueueSnapshot>("/day/pause", input);
export const resumeDay = () => post<QueueSnapshot>("/day/resume");
export const patchDay = (input: PatchDayInput) => patch<QueueSnapshot>("/day", input);

// Tickets and day (admin)
export const openDay = (input: OpenDayInput = {}) => post<QueueSnapshot>("/day/open", input);
export const closeDay = () => post<{ summary: StatsDTO; snapshot: QueueSnapshot }>("/day/close");

export const listTickets = (params: { search?: string; status?: string } = {}) => {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.status) qs.set("status", params.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return get<{ tickets: TicketDTO[] }>(`/tickets${suffix}`);
};
export const createTicket = (input: CreateTicketInput) =>
  post<{ ticket: TicketDTO; snapshot: QueueSnapshot }>("/tickets", input);
export const updateTicket = (id: string, input: { name?: string; phone?: string; notes?: string }) =>
  patch<{ ticket: TicketDTO; snapshot: QueueSnapshot }>(`/tickets/${encodeURIComponent(id)}`, input);
export const removeTicket = (id: string) => del<QueueSnapshot>(`/tickets/${encodeURIComponent(id)}`);
export const rotateTicketToken = (id: string) =>
  post<{ ticket: TicketDTO; snapshot: QueueSnapshot }>(`/tickets/${encodeURIComponent(id)}/rotate-token`);

// Events (admin)
export type EventWithSummary = EventDTO & { summary: EventSummaryDTO };
export const listEvents = () => get<{ events: EventWithSummary[] }>("/events");
export const startEvent = (input: StartEventInput) => post<QueueSnapshot>("/events", input);
export const renameEvent = (input: RenameEventInput) => patch<QueueSnapshot>("/events/current", input);
export const endEvent = () => post<{ summary: EventSummaryDTO; snapshot: QueueSnapshot }>("/events/current/end");

// Public
export const getPublicTicket = (token: string) => get<PublicTicketView>(`/public/tickets/${encodeURIComponent(token)}`);
export const cancelPublicTicket = (token: string) => post<PublicTicketView>(`/public/tickets/${encodeURIComponent(token)}/cancel`);
