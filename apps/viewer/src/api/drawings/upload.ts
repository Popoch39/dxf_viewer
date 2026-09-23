import { type QueryClient, useQueryClient } from "@tanstack/react-query";

import { useUploadStore } from "@/store/upload-store";
import { describeUploadError, NOT_A_DXF } from "@/uploads/errors";
import { nextToStart } from "@/uploads/queue";
import { drawingNameFrom, isDxfFile } from "@/uploads/validation";

import { cacheDrawing, deleteDrawing, drawingQueries, uncacheDrawing } from ".";
import { api, ApiRequestError, unwrap } from "../client";

// More would hold up the browser's connections; the next ones wait their turn.
const MAX_CONCURRENT_UPLOADS = 3;

// Kept out of the store: an Upload is cancelled through it, nothing renders it.
const controllers = new Map<string, AbortController>();

/**
 * Sends a Fichier source to its presigned URL. An XHR rather than `fetch`,
 * which cannot report the progress of a request body.
 */
function putSourceFile(
  url: string,
  file: File,
  onProgress: (loaded: number) => void,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.upload.addEventListener("progress", (event) => {
      onProgress(event.loaded);
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
      } else {
        reject(
          new ApiRequestError(request.status, {
            code: "UPLOAD_FAILED",
            message: `HTTP ${request.status}`,
          }),
        );
      }
    });
    request.addEventListener("error", () => {
      reject(new Error("The upload of the Fichier source failed"));
    });
    request.addEventListener("abort", () => {
      reject(new DOMException("The upload was cancelled", "AbortError"));
    });
    signal.addEventListener(
      "abort",
      () => {
        request.abort();
      },
      { once: true },
    );

    request.open("PUT", url);
    request.send(file);
  });
}

function throwIfCancelled(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new DOMException("The upload was cancelled", "AbortError");
  }
}

/** Creates the Dessin, sends its Fichier source, then signals the end of the Upload. */
async function sendUpload(
  queryClient: QueryClient,
  localId: string,
  file: File,
  signal: AbortSignal,
): Promise<void> {
  const store = useUploadStore.getState();

  const pending = await unwrap(
    api.drawings.post({
      name: drawingNameFrom(file.name),
      filename: file.name,
      sizeBytes: file.size,
    }),
  );

  const { id } = pending.drawing;

  // Recorded before the cancellation check, so that a cancelled Upload finds its Dessin.
  store.created(localId, id);
  cacheDrawing(queryClient, pending.drawing);
  throwIfCancelled(signal);

  await putSourceFile(
    pending.uploadUrl,
    file,
    (loaded) => {
      store.progressed(localId, performance.now(), loaded);
    },
    signal,
  );

  throwIfCancelled(signal);
  store.completing(localId);
  cacheDrawing(queryClient, await unwrap(api.drawings({ id }).complete.post()));
}

/** Drops an Upload; a cancelled or failed Upload leaves no Dessin behind. */
async function discardUpload(queryClient: QueryClient, localId: string): Promise<void> {
  const store = useUploadStore.getState();
  const drawingId = store.uploads.find((upload) => upload.localId === localId)?.drawingId ?? null;

  store.removed(localId);

  if (drawingId === null) {
    return;
  }

  uncacheDrawing(queryClient, drawingId);

  try {
    await deleteDrawing(drawingId);
  } catch {
    // Still there: the refetched list shows it as an interrupted Upload.
    await queryClient.invalidateQueries({ queryKey: drawingQueries.list().queryKey });
  }
}

async function runUpload(queryClient: QueryClient, localId: string, file: File): Promise<void> {
  const controller = new AbortController();

  controllers.set(localId, controller);
  useUploadStore.getState().started(localId);

  try {
    await sendUpload(queryClient, localId, file, controller.signal);
    useUploadStore.getState().removed(localId);
  } catch (error) {
    if (controller.signal.aborted) {
      await discardUpload(queryClient, localId);
    } else {
      const failure = error instanceof Error ? error : new Error("The Upload failed");

      useUploadStore.getState().failed(localId, describeUploadError(failure));
    }
  } finally {
    controllers.delete(localId);
    startWaitingUploads(queryClient);
  }
}

function startWaitingUploads(queryClient: QueryClient): void {
  for (const upload of nextToStart(useUploadStore.getState().uploads, MAX_CONCURRENT_UPLOADS)) {
    void runUpload(queryClient, upload.localId, upload.file);
  }
}

/**
 * Queues the Upload of each file as a new Dessin. A file that is not a DXF gets
 * a failed Upload, never sent.
 */
export function useStartUploads(): (files: File[]) => void {
  const queryClient = useQueryClient();

  return (files) => {
    useUploadStore.getState().added(
      files.map((file) => {
        const valid = isDxfFile(file.name);

        return {
          localId: crypto.randomUUID(),
          file,
          drawingId: null,
          phase: valid ? "waiting" : "error",
          loaded: 0,
          samples: [],
          error: valid ? null : NOT_A_DXF,
        };
      }),
    );
    startWaitingUploads(queryClient);
  };
}

/** Cancels an Upload, or dismisses a failed one: its Dessin, if any, is deleted. */
export function useCancelUpload(): (localId: string) => void {
  const queryClient = useQueryClient();

  return (localId) => {
    const controller = controllers.get(localId);

    // A running Upload is discarded by `runUpload` once its requests stop.
    if (controller === undefined) {
      void discardUpload(queryClient, localId);
    } else {
      controller.abort();
    }
  };
}
