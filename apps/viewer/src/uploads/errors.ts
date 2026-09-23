import { ApiRequestError } from "@/api/client";

const GENERIC_MESSAGE = "L'Upload a échoué. Réessayez dans un instant.";

const TOO_LARGE = "Le fichier dépasse la taille maximale acceptée.";

export const NOT_A_DXF = "Ce fichier n'est pas un DXF.";

/** Message shown on the card of an Upload that failed. */
export function describeUploadError(error: Error): string {
  if (!(error instanceof ApiRequestError)) {
    return GENERIC_MESSAGE;
  }

  if (error.code === "SOURCE_FILE_TOO_LARGE") {
    return TOO_LARGE;
  }

  // The declared size is checked against the limit by the API's body schema.
  if (
    error.code === "VALIDATION" &&
    error.details?.some(({ path }) => path.includes("sizeBytes")) === true
  ) {
    return TOO_LARGE;
  }

  return GENERIC_MESSAGE;
}
