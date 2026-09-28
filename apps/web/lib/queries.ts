"use client";

import type { QueueSnapshot } from "@boothq/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";
import { ApiError } from "./api";

export const queueKey = ["queue"] as const;

export function useQueue() {
  return useQuery({
    queryKey: queueKey,
    queryFn: api.getQueue,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  });
}

const ticketSearchKey = ["tickets-search"] as const;

export function useTicketSearch(search: string) {
  return useQuery({
    queryKey: [...ticketSearchKey, search],
    queryFn: () => api.listTickets({ search }),
    enabled: search.length > 0,
    placeholderData: keepPreviousData,
  });
}

export function usePublicTicket(token: string) {
  return useQuery({
    queryKey: ["public-ticket", token],
    queryFn: () => api.getPublicTicket(token),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });
}

export function useCancelTicket(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.cancelPublicTicket(token),
    onSuccess: (view) => {
      queryClient.setQueryData(["public-ticket", token], view);
    },
  });
}

function snapshotFromError(error: unknown): QueueSnapshot | null {
  if (error instanceof ApiError && error.details && "snapshot" in error.details) {
    return error.details.snapshot as QueueSnapshot;
  }
  return null;
}

// Every staff mutation writes its returned snapshot into the query cache so
// the acting phone updates instantly; a 409's details.snapshot does the same
// so the UI can resync without another request (docs/API.md → Conventions).
function useQueueMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<QueueSnapshot>) {
  const queryClient = useQueryClient();
  return useMutation<QueueSnapshot, unknown, TVariables>({
    mutationFn,
    onSuccess: (snapshot) => {
      queryClient.setQueryData(queueKey, snapshot);
      void queryClient.invalidateQueries({ queryKey: ticketSearchKey });
    },
    onError: (error) => {
      const snapshot = snapshotFromError(error);
      if (snapshot) queryClient.setQueryData(queueKey, snapshot);
    },
  });
}

function useTicketMutation<TVariables, TResult extends { snapshot: QueueSnapshot }>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation<TResult, unknown, TVariables>({
    mutationFn,
    onSuccess: (result) => {
      queryClient.setQueryData(queueKey, result.snapshot);
      void queryClient.invalidateQueries({ queryKey: ticketSearchKey });
    },
    onError: (error) => {
      const snapshot = snapshotFromError(error);
      if (snapshot) queryClient.setQueryData(queueKey, snapshot);
    },
  });
}

export function useOpenDay() {
  return useQueueMutation(api.openDay);
}

export function useCloseDay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.closeDay,
    onSuccess: (result) => {
      queryClient.setQueryData(queueKey, result.snapshot);
      void queryClient.invalidateQueries({ queryKey: ticketSearchKey });
    },
    onError: (error) => {
      const snapshot = snapshotFromError(error);
      if (snapshot) queryClient.setQueryData(queueKey, snapshot);
    },
  });
}

export function useCallNext() {
  return useQueueMutation((expectedNextId?: string) => api.callNext(expectedNextId));
}

export function useStartTicket() {
  return useQueueMutation((id: string) => api.startTicket(id));
}

export function useFinishTicket() {
  return useQueueMutation(({ id, callNext }: { id: string; callNext?: boolean }) =>
    api.finishTicket(id, { callNext }),
  );
}

export function useRecallTicket() {
  return useQueueMutation((id: string) => api.recallTicket(id));
}

export function useNoShowTicket() {
  return useQueueMutation((id: string) => api.noShowTicket(id));
}

export function useRequeueTicket() {
  return useQueueMutation(({ id, afterCount }: { id: string; afterCount?: number }) =>
    api.requeueTicket(id, { afterCount }),
  );
}

export function usePauseDay() {
  return useQueueMutation(({ minutes, reason }: { minutes?: number; reason?: string } = {}) =>
    api.pauseDay({ minutes, reason }),
  );
}

export function useResumeDay() {
  return useQueueMutation(api.resumeDay);
}

export function usePatchDay() {
  return useQueueMutation(
    (input: { acceptingTickets?: boolean; defaultDurationSec?: number; changeoverSec?: number; headsUpAhead?: number }) =>
      api.patchDay(input),
  );
}

export function useReorderQueue() {
  return useQueueMutation((order: string[]) => api.reorderQueue({ order }));
}

export function useCreateTicket() {
  return useTicketMutation(api.createTicket);
}

export function useUpdateTicket() {
  return useTicketMutation(
    ({ id, input }: { id: string; input: { name?: string; phone?: string; notes?: string } }) =>
      api.updateTicket(id, input),
  );
}

export function useRemoveTicket() {
  return useQueueMutation((id: string) => api.removeTicket(id));
}

export function useRotateTicketToken() {
  return useTicketMutation((id: string) => api.rotateTicketToken(id));
}
