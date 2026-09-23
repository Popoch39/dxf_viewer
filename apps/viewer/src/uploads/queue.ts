/**
 * Where an Upload stands on the client. It ends with `/complete`: from then on,
 * the Statut of the Dessin tells the rest.
 */
export type UploadPhase = "waiting" | "creating" | "uploading" | "completing" | "error";

const ACTIVE: ReadonlySet<UploadPhase> = new Set<UploadPhase>([
  "creating",
  "uploading",
  "completing",
]);

/** The waiting Uploads to start now, oldest first, so that at most `max` run at once. */
export function nextToStart<Item extends { phase: UploadPhase }>(
  uploads: readonly Item[],
  max: number,
): Item[] {
  const active = uploads.filter((upload) => ACTIVE.has(upload.phase)).length;

  return uploads.filter((upload) => upload.phase === "waiting").slice(0, Math.max(0, max - active));
}
