import { create } from "zustand";

import { type ProgressSample, withSample } from "@/uploads/progress";
import type { UploadPhase } from "@/uploads/queue";

/** An Upload of this tab: the part of its state that only the client knows. */
export interface Upload {
  localId: string;
  file: File;
  /** The Dessin created for it, once `POST /drawings` answered. */
  drawingId: string | null;
  phase: UploadPhase;
  loaded: number;
  samples: ProgressSample[];
  error: string | null;
}

interface UploadState {
  uploads: Upload[];
  added: (uploads: Upload[]) => void;
  started: (localId: string) => void;
  created: (localId: string, drawingId: string) => void;
  progressed: (localId: string, at: number, loaded: number) => void;
  completing: (localId: string) => void;
  failed: (localId: string, error: string) => void;
  removed: (localId: string) => void;
}

function patch(
  uploads: Upload[],
  localId: string,
  change: (upload: Upload) => Partial<Upload>,
): Upload[] {
  return uploads.map((upload) =>
    upload.localId === localId ? { ...upload, ...change(upload) } : upload,
  );
}

/**
 * The only owner of the Uploads in progress on the client: queue, progress and
 * local errors. The Statut of a Dessin is not here, it comes from the API.
 * Written by `src/api/drawings/`, read everywhere else.
 */
export const useUploadStore = create<UploadState>()((set) => ({
  uploads: [],
  added: (uploads) => {
    set((state) => ({ uploads: [...state.uploads, ...uploads] }));
  },
  started: (localId) => {
    set((state) => ({ uploads: patch(state.uploads, localId, () => ({ phase: "creating" })) }));
  },
  created: (localId, drawingId) => {
    set((state) => ({
      uploads: patch(state.uploads, localId, () => ({ drawingId, phase: "uploading" })),
    }));
  },
  progressed: (localId, at, loaded) => {
    set((state) => ({
      uploads: patch(state.uploads, localId, (upload) => ({
        loaded,
        samples: withSample(upload.samples, at, loaded),
      })),
    }));
  },
  completing: (localId) => {
    set((state) => ({ uploads: patch(state.uploads, localId, () => ({ phase: "completing" })) }));
  },
  failed: (localId, error) => {
    set((state) => ({
      uploads: patch(state.uploads, localId, () => ({ phase: "error", error })),
    }));
  },
  removed: (localId) => {
    set((state) => ({ uploads: state.uploads.filter((upload) => upload.localId !== localId) }));
  },
}));

/** Every Upload of this tab, oldest first. */
export function useUploads(): Upload[] {
  return useUploadStore((state) => state.uploads);
}

/** The Upload of this tab that feeds a Dessin, if any. */
export function useUploadOf(drawingId: string): Upload | undefined {
  return useUploadStore((state) => state.uploads.find((upload) => upload.drawingId === drawingId));
}
