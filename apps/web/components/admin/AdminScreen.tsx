"use client";

import type { StatsDTO, TicketDTO } from "@boothq/shared";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ApiError, logout } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { useCloseDay, useOpenDay, useQueue, useReorderQueue, useTicketSearch } from "../../lib/queries";
import { CapsuleButton } from "../ui/CapsuleButton";
import { ConfirmSheet } from "../ui/ConfirmSheet";
import { GlassBar } from "../ui/GlassBar";
import { GroupedList } from "../ui/GroupedList";
import { OfflineBanner } from "../ui/OfflineBanner";
import { QrFullscreen } from "../ui/QrFullscreen";
import { SearchField } from "../ui/SearchField";
import { StatusChip } from "../ui/StatusChip";
import { Toast, useToast } from "../ui/Toast";
import { UndoToast } from "../ui/UndoToast";
import { AdminHeader } from "./AdminHeader";
import { AdminMenu } from "./AdminMenu";
import { ClosedState } from "./ClosedState";
import { EventNameSheet } from "./EventNameSheet";
import { EventsSheet } from "./EventsSheet";
import { CloseSummary } from "./CloseSummary";
import { EditTicketSheet } from "./EditTicketSheet";
import { FinishedSection } from "./FinishedSection";
import { NewTicketSheet } from "./NewTicketSheet";
import { NowCard } from "./NowCard";
import { ReadyForPickupSection } from "./ReadyForPickupSection";
import { OpenBoothSheet } from "./OpenBoothSheet";
import { SettingsSheet } from "./SettingsSheet";
import { ordinal, TicketSheet } from "./TicketSheet";
import { WaitingSection } from "./WaitingSection";
import { formatClockTime } from "../../lib/format";
import { useStaffTitle } from "../../lib/useStaffTitle";

type Overlay =
  | { type: "none" }
  | { type: "openBooth" }
  | { type: "menu" }
  | { type: "newTicket" }
  | { type: "qr"; ticket: TicketDTO }
  | { type: "ticket"; ticketId: string }
  | { type: "editTicket"; ticketId: string }
  | { type: "settings" }
  | { type: "events" }
  | { type: "eventName"; mode: "start" | "rename"; from: "events" | "closed" }
  | { type: "closeConfirm" }
  | { type: "closeSummary"; summary: StatsDTO };

type ReorderState = { mode: "list" } | { mode: "reorder" } | { mode: "confirm"; order: string[]; summary: string };

export function AdminScreen() {
  useStaffTitle();
  const t = useT();
  const router = useRouter();
  const { data: snapshot, dataUpdatedAt } = useQueue();
  const openDay = useOpenDay();
  const closeDay = useCloseDay();
  const reorderQueue = useReorderQueue();
  const { message: toast, showToast } = useToast();

  const [overlay, setOverlay] = useState<Overlay>({ type: "none" });
  const [reorderState, setReorderState] = useState<ReorderState>({ mode: "list" });
  const [search, setSearch] = useState("");

  const trimmedSearch = search.trim();
  // The snapshot only carries the 10 most recent finished tickets, so search
  // goes to the server to reach everyone from today.
  const serverSearch = useTicketSearch(trimmedSearch);

  const allTickets = useMemo(() => {
    if (!snapshot) return [] as TicketDTO[];
    return [
      ...(snapshot.current ? [snapshot.current] : []),
      ...snapshot.waiting,
      ...snapshot.readyForPickup,
      ...snapshot.recent,
    ];
  }, [snapshot]);

  const findTicket = (id: string): TicketDTO | undefined =>
    allTickets.find((t) => t.id === id) ?? serverSearch.data?.tickets.find((t) => t.id === id);

  const searchResults = useMemo(() => {
    const query = trimmedSearch.toLowerCase();
    if (!query) return null;
    if (serverSearch.data) {
      const fresh = new Map(allTickets.map((t) => [t.id, t]));
      return serverSearch.data.tickets.map((t) => fresh.get(t.id) ?? t);
    }
    const digits = query.replace(/\D/g, "");
    return allTickets.filter((t) => {
      if (String(t.number) === query) return true;
      if (t.name.toLowerCase().includes(query)) return true;
      return digits.length > 0 && Boolean(t.phone?.replace(/\D/g, "").includes(digits));
    });
  }, [allTickets, trimmedSearch, serverSearch.data]);

  if (!snapshot) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-fill border-t-label-2" role="status" aria-label={t("common.loading")} />
      </div>
    );
  }

  const activeEvent = snapshot.event;
  const dayOpen = snapshot.day != null;

  // Shared by the closed card and the open-day screen.
  const eventSheets = (
    <>
      {overlay.type === "events" ? (
        <EventsSheet
          dayOpen={dayOpen}
          onClose={() => setOverlay({ type: "none" })}
          onStart={() => setOverlay({ type: "eventName", mode: "start", from: "events" })}
          onRename={() => setOverlay({ type: "eventName", mode: "rename", from: "events" })}
          onToast={showToast}
        />
      ) : null}
      {overlay.type === "eventName" ? (
        <EventNameSheet
          mode={overlay.mode}
          currentName={activeEvent?.name ?? null}
          onClose={() => setOverlay(overlay.from === "events" ? { type: "events" } : { type: "none" })}
          onDone={(message) => {
            showToast(message);
            setOverlay(overlay.from === "events" && overlay.mode === "rename" ? { type: "events" } : { type: "none" });
          }}
        />
      ) : null}
    </>
  );

  if (!snapshot.day) {
    // The summary must win even though the day is already closed by the
    // time this renders: buildQueueSnapshot() returns day: null the instant
    // closeDay succeeds, which is before the user has seen the numbers.
    if (overlay.type === "closeSummary") {
      return <CloseSummary summary={overlay.summary} onDone={() => setOverlay({ type: "none" })} />;
    }

    return (
      <>
        <ClosedState
          event={activeEvent}
          onOpenBooth={() => setOverlay({ type: "openBooth" })}
          onStartEvent={() => setOverlay({ type: "eventName", mode: "start", from: "closed" })}
          onChangeEvent={() => setOverlay({ type: "events" })}
          readyForPickup={snapshot.readyForPickup}
          onToast={showToast}
        />
        {overlay.type === "openBooth" ? (
          <OpenBoothSheet
            onClose={() => setOverlay({ type: "none" })}
            pending={openDay.isPending}
            onSubmit={(input) => openDay.mutate(input, { onSuccess: () => setOverlay({ type: "none" }) })}
          />
        ) : null}
        {eventSheets}
        <Toast message={toast} />
      </>
    );
  }

  const { day } = snapshot;
  const { stats } = snapshot;
  const totalTicketsCreated =
    stats.servedCount + stats.noShowCount + stats.cancelledCount + stats.waitingCount + (snapshot.current ? 1 : 0);

  async function handleCopyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      showToast(t("admin.linkCopied"));
    } catch {
      showToast(t("admin.linkCopyFailed"));
    }
  }

  return (
    <div className="min-h-dvh bg-bg pb-[110px] text-label">
      <OfflineBanner lastUpdated={dataUpdatedAt ? new Date(dataUpdatedAt) : null} />

      <div className="flex flex-col gap-3 px-4 pt-3">
        <AdminHeader
          day={day}
          waitingCount={snapshot.stats.waitingCount}
          avgSessionLabel={t("fmt.min", { n: Math.round(snapshot.stats.avgSessionSec / 60) })}
          projectedFinishLabel={snapshot.stats.projectedFinishAt ? formatClockTime(snapshot.stats.projectedFinishAt) : "—"}
          onMenu={() => setOverlay({ type: "menu" })}
        />

        <SearchField value={search} onChange={setSearch} placeholder={t("admin.searchPlaceholder")} />

        {searchResults ? (
          <GroupedList>
            {searchResults.length === 0 ? (
              <div className="flex min-h-16 items-center px-4 text-[15px] text-label-2">{t("admin.noMatch")}</div>
            ) : (
              searchResults.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => setOverlay({ type: "ticket", ticketId: ticket.id })}
                  className="flex min-h-[56px] w-full cursor-pointer items-center gap-3 bg-transparent px-4 text-left"
                >
                  <span className="w-8 shrink-0 text-[15px] font-semibold tabular-nums text-label-2">#{ticket.number}</span>
                  <span className="min-w-0 flex-grow truncate text-[15px]">{ticket.name}</span>
                  <StatusChip status={ticket.status} />
                </button>
              ))
            )}
          </GroupedList>
        ) : (
          <>
            <ReadyForPickupSection
              tickets={snapshot.readyForPickup}
              onRowClick={(id) => setOverlay({ type: "ticket", ticketId: id })}
              onToast={showToast}
            />

            <NowCard ticket={snapshot.current} onOpen={(id) => setOverlay({ type: "ticket", ticketId: id })} />

            <WaitingSection
              tickets={snapshot.waiting}
              reordering={reorderState.mode === "reorder"}
              onRowClick={(id) => setOverlay({ type: "ticket", ticketId: id })}
              onEnterReorder={() => setReorderState({ mode: "reorder" })}
              onCancelReorder={() => setReorderState({ mode: "list" })}
              onRequestConfirm={(order, summary) => setReorderState({ mode: "confirm", order, summary })}
            />

            <FinishedSection tickets={snapshot.recent} onRowClick={(id) => setOverlay({ type: "ticket", ticketId: id })} />
          </>
        )}
      </div>

      {reorderState.mode !== "confirm" ? (
        <GlassBar className="fixed inset-x-3 bottom-6">
          <CapsuleButton onClick={() => setOverlay({ type: "newTicket" })}>{t("admin.newTicket")}</CapsuleButton>
        </GlassBar>
      ) : null}

      {reorderState.mode === "confirm" ? (
        <ConfirmSheet
          title={t("admin.reorder.title")}
          description={reorderState.summary}
          onCancel={() => setReorderState({ mode: "reorder" })}
          onConfirm={() => {
            const { order } = reorderState;
            reorderQueue.mutate(order, {
              onSuccess: () => {
                setReorderState({ mode: "list" });
                showToast(t("admin.reorder.updated"));
              },
              onError: () => {
                setReorderState({ mode: "list" });
                showToast(t("admin.reorder.changed"));
              },
            });
          }}
        />
      ) : null}

      {overlay.type === "menu" ? (
        <AdminMenu
          onClose={() => setOverlay({ type: "none" })}
          onSettings={() => setOverlay({ type: "settings" })}
          onEvents={() => setOverlay({ type: "events" })}
          onCloseBooth={() => setOverlay({ type: "closeConfirm" })}
          onLogout={() => {
            void logout().then(() => router.replace("/login"));
          }}
        />
      ) : null}

      {eventSheets}

      {overlay.type === "settings" ? (
        <SettingsSheet day={day} stats={snapshot.stats} onClose={() => setOverlay({ type: "none" })} />
      ) : null}

      {overlay.type === "closeConfirm" ? (
        <ConfirmSheet
          title={t("admin.close.title")}
          description={t(snapshot.waiting.length === 1 ? "admin.close.desc" : "admin.close.descMany", { n: snapshot.waiting.length })}
          confirmLabel={t("admin.menu.closeBooth")}
          destructive
          pending={closeDay.isPending}
          onCancel={() => setOverlay({ type: "none" })}
          onConfirm={() =>
            closeDay.mutate(undefined, {
              onSuccess: (result) => setOverlay({ type: "closeSummary", summary: result.summary }),
              onError: (err) =>
                showToast(
                  err instanceof ApiError && err.code === "CURRENT_ACTIVE"
                    ? t("admin.close.finishFirst")
                    : t("admin.close.failed"),
                ),
            })
          }
        />
      ) : null}
      {/* closeSummary is handled above, in the !snapshot.day branch — the
          day is already closed by the time this state is set. */}

      {overlay.type === "newTicket" ? (
        <NewTicketSheet
          nextNumber={totalTicketsCreated + 1}
          onClose={() => setOverlay({ type: "none" })}
          onCreated={(ticket) => setOverlay({ type: "qr", ticket })}
          onShowExisting={(ticket) => setOverlay({ type: "qr", ticket })}
        />
      ) : null}

      {overlay.type === "qr" ? (
        <QrFullscreen
          number={overlay.ticket.number}
          name={overlay.ticket.name}
          url={overlay.ticket.customerUrl}
          onCopyLink={() => handleCopyLink(overlay.ticket.customerUrl)}
          onDone={() => setOverlay({ type: "none" })}
        />
      ) : null}

      {overlay.type === "ticket"
        ? (() => {
            const ticket = findTicket(overlay.ticketId);
            if (!ticket) return null;
            return (
              <TicketSheet
                ticket={ticket}
                positionLabel={ticket.status === "WAITING" && ticket.position ? ordinal(ticket.position, t) : null}
                onClose={() => setOverlay({ type: "none" })}
                onEdit={() => setOverlay({ type: "editTicket", ticketId: ticket.id })}
                onShowQr={() => setOverlay({ type: "qr", ticket })}
                onToast={showToast}
              />
            );
          })()
        : null}

      {overlay.type === "editTicket"
        ? (() => {
            const ticket = findTicket(overlay.ticketId);
            if (!ticket) return null;
            return <EditTicketSheet ticket={ticket} onClose={() => setOverlay({ type: "none" })} />;
          })()
        : null}

      <UndoToast currentUndoId={snapshot.undo?.actionId} onToast={showToast} />
      <Toast message={toast} />
    </div>
  );
}
