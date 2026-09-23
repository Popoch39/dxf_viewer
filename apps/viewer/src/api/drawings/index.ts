import { type TSchema, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import {
  type QueryClient,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";

import { env } from "@/env";

import { api, unwrap } from "../client";

export { useCancelUpload, useStartUploads } from "./upload";

function fetchDrawings() {
  return unwrap(api.drawings.get());
}

/** Résumé of a Dessin, as listed by the API. */
export type DrawingSummary = Awaited<ReturnType<typeof fetchDrawings>>[number];

export type DrawingStatus = DrawingSummary["status"];

export const drawingQueries = {
  all: () => ["drawings"] as const,
  list: () =>
    queryOptions({
      queryKey: [...drawingQueries.all(), "list"],
      queryFn: fetchDrawings,
    }),
};

/** Puts a Dessin at the head of the cached list, or replaces it there. */
export function cacheDrawing(queryClient: QueryClient, summary: DrawingSummary): void {
  queryClient.setQueryData(drawingQueries.list().queryKey, (list) => {
    if (list === undefined) {
      return [summary];
    }

    return list.some((drawing) => drawing.id === summary.id)
      ? list.map((drawing) => (drawing.id === summary.id ? summary : drawing))
      : [summary, ...list];
  });
}

/** Takes a Dessin out of the cached list. */
export function uncacheDrawing(queryClient: QueryClient, id: string): void {
  queryClient.setQueryData(drawingQueries.list().queryKey, (list) =>
    list?.filter((drawing) => drawing.id !== id),
  );
}

export function deleteDrawing(id: string) {
  return unwrap(api.drawings({ id }).delete());
}

/** The caller's Dessins, most recent first. */
export function useDrawings() {
  return useQuery(drawingQueries.list());
}

export function useDeleteDrawing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteDrawing,
    onSuccess: (_, id) => {
      uncacheDrawing(queryClient, id);
    },
  });
}

interface StatusEvent {
  status: DrawingStatus;
  error: string | null;
}

// Typed against the API's own Statut, so a new one fails the type check here.
const StatusEventSchema: TSchema & { static: StatusEvent } = Type.Object({
  status: Type.Union([
    Type.Literal("awaiting_upload"),
    Type.Literal("queued"),
    Type.Literal("parsing"),
    Type.Literal("ready"),
    Type.Literal("failed"),
  ]),
  error: Type.Union([Type.String(), Type.Null()]),
});

function parseStatusEvent(data: string): StatusEvent | null {
  try {
    const event: unknown = JSON.parse(data);

    return Value.Check(StatusEventSchema, event) ? event : null;
  } catch {
    return null;
  }
}

/**
 * Follows the Statut of a Dessin while `enabled`, through the API's server-sent
 * events, and writes each change to the cached list. A final Statut refetches
 * the list, for the Résumé the Parsing filled.
 */
export function useDrawingStatus(id: string, enabled: boolean): void {
  const queryClient = useQueryClient();

  useEffect(
    () => (enabled ? followStatus(queryClient, id) : undefined),
    [id, enabled, queryClient],
  );
}

/** Opens the Statut stream of a Dessin; the returned function closes it. */
function followStatus(queryClient: QueryClient, id: string): () => void {
  const source = new EventSource(`${env.apiUrl}/drawings/${id}/events`, {
    withCredentials: true,
  });

  // An EventSource always hands its data as text.
  source.addEventListener("status", (message: MessageEvent<string>) => {
    const event = parseStatusEvent(message.data);

    if (event === null) {
      return;
    }

    queryClient.setQueryData(drawingQueries.list().queryKey, (list) =>
      list?.map((drawing) => (drawing.id === id ? { ...drawing, ...event } : drawing)),
    );

    if (event.status === "ready" || event.status === "failed") {
      void queryClient.invalidateQueries({ queryKey: drawingQueries.list().queryKey });
    }
  });

  return () => {
    source.close();
  };
}
