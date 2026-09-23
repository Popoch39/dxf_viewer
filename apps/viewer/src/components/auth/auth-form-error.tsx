import { describeAuthError } from "@/auth/errors";

/** The API's refusal of a sign-in or sign-up, explained to the Utilisateur. */
export function AuthFormError({ error }: { error: Error | null }) {
  if (error === null) {
    return null;
  }

  return (
    <p role="alert" className="text-sm text-destructive">
      {describeAuthError(error)}
    </p>
  );
}
