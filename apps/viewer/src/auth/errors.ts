import { ApiRequestError } from "@/api/client";

const GENERIC_MESSAGE = "Une erreur est survenue. Réessayez dans un instant.";

const EMAIL_TAKEN = "Un Utilisateur existe déjà avec cet email.";

// Better Auth error codes (`@better-auth/core/error`) the forms can run into.
const MESSAGES = new Map<string, string>([
  ["INVALID_EMAIL_OR_PASSWORD", "Email ou mot de passe incorrect."],
  ["USER_ALREADY_EXISTS", EMAIL_TAKEN],
  ["USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", EMAIL_TAKEN],
  ["INVALID_EMAIL", "Adresse email invalide."],
  ["PASSWORD_TOO_SHORT", "Le mot de passe est trop court."],
  ["PASSWORD_TOO_LONG", "Le mot de passe est trop long."],
]);

/** Message shown to the Utilisateur when signing in, up or out fails. */
export function describeAuthError(error: Error): string {
  if (!(error instanceof ApiRequestError)) {
    return GENERIC_MESSAGE;
  }

  return MESSAGES.get(error.code) ?? GENERIC_MESSAGE;
}
