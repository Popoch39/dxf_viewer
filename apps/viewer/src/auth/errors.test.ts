import { describe, expect, it } from "vitest";

import { ApiRequestError } from "@/api/client";

import { describeAuthError } from "./errors";

function authError(status: number, code: string): ApiRequestError {
  return new ApiRequestError(status, { code, message: "Raw Better Auth message" });
}

describe("describeAuthError", () => {
  it("explains wrong credentials", () => {
    expect(describeAuthError(authError(401, "INVALID_EMAIL_OR_PASSWORD"))).toBe(
      "Email ou mot de passe incorrect.",
    );
  });

  it("explains an email already used by another Utilisateur", () => {
    const expected = "Un Utilisateur existe déjà avec cet email.";

    expect(describeAuthError(authError(422, "USER_ALREADY_EXISTS"))).toBe(expected);
    expect(describeAuthError(authError(422, "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"))).toBe(
      expected,
    );
  });

  it("falls back to a generic message for an unknown code", () => {
    expect(describeAuthError(authError(500, "INTERNAL_SERVER_ERROR"))).toBe(
      "Une erreur est survenue. Réessayez dans un instant.",
    );
  });

  it("falls back to a generic message for a network failure", () => {
    expect(describeAuthError(new TypeError("Failed to fetch"))).toBe(
      "Une erreur est survenue. Réessayez dans un instant.",
    );
  });
});
