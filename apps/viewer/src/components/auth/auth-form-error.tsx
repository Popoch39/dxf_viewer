import { describeAuthError } from "@/auth/errors";

/**
 * The API's refusal of a sign-in or sign-up, explained to the Utilisateur.
 * Its line stays reserved without an error, so that the form does not move when one shows up.
 */
export function AuthFormError({ error }: { error: Error | null }) {
  return (
    <p
      role={error === null ? undefined : "alert"}
      className="min-h-5 text-sm leading-5 text-destructive"
    >
      {error === null ? null : describeAuthError(error)}
    </p>
  );
}
