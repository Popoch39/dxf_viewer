import { describe, expect, it } from "vitest";

import { ApiRequestError } from "@/api/client";

import { describeUploadError } from "./errors";

const TOO_LARGE = "Le fichier dépasse la taille maximale acceptée.";

describe("describeUploadError", () => {
  it("explains a Fichier source over the limit, found when the Upload completes", () => {
    const error = new ApiRequestError(413, { code: "SOURCE_FILE_TOO_LARGE", message: "Too large" });

    expect(describeUploadError(error)).toBe(TOO_LARGE);
  });

  it("explains a declared size over the limit", () => {
    const error = new ApiRequestError(400, {
      code: "VALIDATION",
      message: "Invalid request",
      details: [{ path: "/sizeBytes", message: "Expected integer to be less or equal to 1000" }],
    });

    expect(describeUploadError(error)).toBe(TOO_LARGE);
  });

  it("falls back to a generic message", () => {
    expect(describeUploadError(new Error("network"))).toBe(
      "L'Upload a échoué. Réessayez dans un instant.",
    );
  });
});
