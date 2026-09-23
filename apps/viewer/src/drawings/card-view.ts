import type { DrawingSummary } from "@/api/drawings";
import type { Upload } from "@/store/upload-store";
import { formatBytes, formatDuration, percentSent, remainingSeconds } from "@/uploads/progress";

export type CardState = "idle" | "uploading" | "processing" | "error" | "done";

/** What the card of a Dessin, or of an Upload without one yet, shows. */
export interface CardView {
  state: CardState;
  description: string;
  /** Percent sent, while the Fichier source is being uploaded. */
  progress: number | null;
}

const entities = new Intl.PluralRules("fr-FR");

function countEntities(counts: DrawingSummary["entityCounts"]): number {
  return Object.values(counts ?? {}).reduce((sum, count) => sum + count, 0);
}

function describeReady(drawing: DrawingSummary): string {
  const count = countEntities(drawing.entityCounts);

  const parts = [
    drawing.sizeBytes === null ? null : formatBytes(drawing.sizeBytes),
    drawing.dxfVersion === null ? null : `DXF ${drawing.dxfVersion}`,
    `${count} ${entities.select(count) === "one" ? "entité" : "entités"}`,
  ];

  return parts.filter((part) => part !== null).join(" · ");
}

function describeProgress(upload: Upload): CardView {
  const total = upload.file.size;
  const remaining = remainingSeconds(upload.samples, total);
  const progress = percentSent(upload.loaded, total);

  const left =
    remaining === null ? "calcul du temps restant…" : `${formatDuration(remaining)} restantes`;

  return {
    state: "uploading",
    description: `${formatBytes(upload.loaded)} sur ${formatBytes(total)} · ${progress} % · ${left}`,
    progress,
  };
}

/** The card of an Upload that has no Dessin yet: waiting, starting, or refused. */
export function describeUpload(upload: Upload): CardView {
  switch (upload.phase) {
    case "waiting": {
      return {
        state: "idle",
        description: `En attente · ${formatBytes(upload.file.size)}`,
        progress: null,
      };
    }

    case "error": {
      return { state: "error", description: upload.error ?? "", progress: null };
    }

    case "uploading": {
      return describeProgress(upload);
    }

    case "completing": {
      return { state: "processing", description: "Vérification du fichier…", progress: null };
    }

    case "creating": {
      break;
    }
  }

  return { state: "uploading", description: "Préparation de l'Upload…", progress: null };
}

/** The card of a Dessin: its Upload in this tab while there is one, then its Statut. */
export function describeDrawing(drawing: DrawingSummary, upload?: Upload): CardView {
  if (upload !== undefined) {
    return describeUpload(upload);
  }

  switch (drawing.status) {
    case "awaiting_upload": {
      return { state: "error", description: "Upload interrompu", progress: null };
    }

    case "queued": {
      return { state: "processing", description: "En file d'attente", progress: null };
    }

    case "parsing": {
      return { state: "processing", description: "Parsing en cours…", progress: null };
    }

    case "ready": {
      return { state: "done", description: describeReady(drawing), progress: null };
    }

    case "failed": {
      break;
    }
  }

  return { state: "error", description: drawing.error ?? "Le Parsing a échoué.", progress: null };
}
