"use client";

import type { TicketDTO } from "@boothq/shared";
import { formatDuration } from "@boothq/shared/format";
import { Camera, ChevronRight, GripVertical, Pen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getServerNow } from "../../lib/server-time";
import { GroupedList, GroupedSeparator } from "../ui/GroupedList";

const ROW_HEIGHT = 63;

type WaitingSectionProps = {
  tickets: TicketDTO[]; // canonical order, by position
  reordering: boolean;
  onRowClick: (ticketId: string) => void;
  onEnterReorder: () => void;
  onCancelReorder: () => void;
  onRequestConfirm: (order: string[], summary: string) => void;
};

function waitedLabel(ticket: TicketDTO): string {
  const sec = Math.max(0, Math.round((getServerNow().getTime() - new Date(ticket.createdAt).getTime()) / 1000));
  return `Waiting ${formatDuration(sec)}`;
}

function formatEtaShort(etaSec: number): string {
  if (etaSec < 60) return "Any moment";
  return `~${Math.round(etaSec / 60)} min`;
}

function summarizeReorder(oldOrder: TicketDTO[], newOrder: TicketDTO[]): string {
  let moverIdx = -1;
  let maxDelta = 0;
  newOrder.forEach((ticket, i) => {
    const oldIdx = oldOrder.findIndex((o) => o.id === ticket.id);
    const delta = oldIdx - i;
    if (delta > maxDelta) {
      maxDelta = delta;
      moverIdx = i;
    }
  });
  if (moverIdx === -1) return "This changes their estimated wait times.";

  const mover = newOrder[moverIdx]!;
  const oldIdx = oldOrder.findIndex((o) => o.id === mover.id);
  const jumped = oldOrder.slice(moverIdx, oldIdx).map((t) => t.name);
  const jumpedLabel =
    jumped.length === 0
      ? "to the front"
      : jumped.length === 1
        ? `ahead of ${jumped[0]}`
        : `ahead of ${jumped.slice(0, -1).join(", ")} and ${jumped[jumped.length - 1]}`;
  const positionLabel = moverIdx === 0 ? "next" : `position ${moverIdx + 1}`;
  return `${mover.name} will move to ${positionLabel}, ${jumpedLabel}. This changes their estimated wait times.`;
}

export function WaitingSection({
  tickets,
  reordering,
  onRowClick,
  onEnterReorder,
  onCancelReorder,
  onRequestConfirm,
}: WaitingSectionProps) {
  const [order, setOrder] = useState<string[]>(() => tickets.map((t) => t.id));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const dragState = useRef<{ startY: number; id: string } | null>(null);

  // Track the canonical order continuously in list mode (every poll,
  // including the initial load); freeze it during an active drag so
  // polling can't fight the in-progress reorder.
  useEffect(() => {
    if (!reordering) setOrder(tickets.map((t) => t.id));
  }, [tickets, reordering]);

  useEffect(() => {
    if (!draggingId) return;

    function handleMove(event: PointerEvent) {
      const state = dragState.current;
      if (!state) return;
      const deltaY = event.clientY - state.startY;
      setDragOffset(deltaY);
      const shift = Math.round(deltaY / ROW_HEIGHT);
      if (shift !== 0) {
        setOrder((prev) => {
          const idx = prev.indexOf(state.id);
          const nextIdx = Math.min(prev.length - 1, Math.max(0, idx + shift));
          if (nextIdx === idx) return prev;
          const next = [...prev];
          next.splice(idx, 1);
          next.splice(nextIdx, 0, state.id);
          return next;
        });
        state.startY = event.clientY;
        setDragOffset(0);
      }
    }

    function handleUp() {
      setDraggingId(null);
      setDragOffset(0);
      dragState.current = null;
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [draggingId]);

  const byId = new Map(tickets.map((t) => [t.id, t]));
  const displayTickets = order.map((id) => byId.get(id)).filter((t): t is TicketDTO => Boolean(t));

  function startDrag(id: string, clientY: number) {
    dragState.current = { startY: clientY, id };
    setDraggingId(id);
  }

  function handleDone() {
    const changed = order.some((id, i) => id !== tickets[i]?.id);
    if (!changed) {
      onCancelReorder();
      return;
    }
    onRequestConfirm(order, summarizeReorder(tickets, displayTickets));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="mt-1.5 flex items-center justify-between px-4">
        <h2 className="m-0 text-[13px] font-semibold uppercase tracking-[0.02em] text-label-2">
          Waiting · {tickets.length}
        </h2>
        {reordering ? (
          <div className="flex items-center gap-3">
            <button type="button" onClick={onCancelReorder} className="cursor-pointer bg-transparent text-[15px] text-link">
              Cancel
            </button>
            <button type="button" onClick={handleDone} className="cursor-pointer bg-transparent text-[15px] font-semibold text-link">
              Done
            </button>
          </div>
        ) : tickets.length > 1 ? (
          <button type="button" onClick={onEnterReorder} className="cursor-pointer bg-transparent text-[15px] font-semibold text-link">
            Reorder
          </button>
        ) : null}
      </div>

      <GroupedList>
        {displayTickets.length === 0 ? (
          <div className="flex min-h-16 items-center px-4 text-[15px] text-label-2">No one waiting</div>
        ) : null}
        {displayTickets.map((ticket, index) => {
          const isDragged = ticket.id === draggingId;
          const prevDragged = index > 0 && displayTickets[index - 1]?.id === draggingId;
          return (
            <div key={ticket.id}>
              {index > 0 && !isDragged && !prevDragged ? <GroupedSeparator inset={70} /> : null}
              {reordering ? (
                <div
                  className="flex items-center gap-2.5 px-3.5 py-2"
                  style={{
                    minHeight: 62,
                    background: isDragged ? "var(--card)" : "transparent",
                    boxShadow: isDragged ? "0 8px 20px rgba(0,0,0,0.18)" : "none",
                    borderRadius: isDragged ? 16 : 0,
                    transform: isDragged ? `translateY(${dragOffset}px)` : undefined,
                    touchAction: "none",
                  }}
                >
                  <span
                    onPointerDown={(event) => {
                      event.currentTarget.setPointerCapture(event.pointerId);
                      startDrag(ticket.id, event.clientY);
                    }}
                    className="flex shrink-0 cursor-grab touch-none items-center text-label-2 active:cursor-grabbing"
                  >
                    <GripVertical className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                  </span>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center shape-sq bg-fill text-[17px] font-bold tabular-nums">
                    {ticket.number}
                  </span>
                  <span className="flex min-w-0 flex-grow flex-col gap-0.5">
                    <span className="truncate text-[17px] font-semibold">{ticket.name}</span>
                    <span className="truncate text-[13px] text-label-2">{waitedLabel(ticket)}</span>
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onRowClick(ticket.id)}
                  className="flex w-full cursor-pointer items-center gap-3 bg-transparent px-3 py-2 pl-3.5 text-left"
                  style={{ minHeight: 62 }}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center shape-sq bg-fill text-[17px] font-bold tabular-nums">
                    {ticket.number}
                  </span>
                  <span className="flex min-w-0 flex-grow flex-col gap-0.5">
                    <span className="flex items-center gap-1.5 truncate text-[17px] font-semibold">
                      {ticket.name}
                      {ticket.mode === "FROM_PHOTO" ? (
                        <Camera className="h-[13px] w-[13px] shrink-0 text-label-2" strokeWidth={2} aria-label="Drawn from photo" />
                      ) : null}
                      {ticket.notes ? (
                        <Pen className="h-[13px] w-[13px] shrink-0 text-label-2" strokeWidth={2} aria-label="Has a note" />
                      ) : null}
                    </span>
                    <span className="truncate text-[13px] text-label-2">{waitedLabel(ticket)}</span>
                  </span>
                  <span className="shrink-0 text-[15px] tabular-nums text-label-2">
                    {ticket.etaSec != null ? formatEtaShort(ticket.etaSec) : null}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-separator" strokeWidth={2} aria-hidden="true" />
                </button>
              )}
            </div>
          );
        })}
      </GroupedList>
    </div>
  );
}
