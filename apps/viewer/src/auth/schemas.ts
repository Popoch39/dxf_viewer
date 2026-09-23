import { z } from "zod";

// Any other value is dropped: the page then falls back to `/`.
function noRedirect(): string | undefined {
  return;
}

// Only a path of the viewer: `//host` and `/\host` are read as another origin
// by browsers, which would turn the login page into an open redirect.
const internalPath = z
  .string()
  .regex(/^\/(?![/\\])/u)
  .optional()
  .catch(noRedirect);

/** Search params of `/login` and `/register`: where to go once signed in. */
export const authSearchSchema = z.object({ redirect: internalPath });

const email = z.email({ error: "Adresse email invalide." });

/** Signing in only checks the shape: the API decides whether it matches. */
export const signInSchema = z.object({
  email,
  password: z.string().min(1, { error: "Saisissez votre mot de passe." }),
});

export type SignInValues = z.infer<typeof signInSchema>;

/** Mirrors the API's rules (Better Auth defaults: 8 to 128 characters). */
export const signUpSchema = z.object({
  name: z.string().trim().min(1, { error: "Saisissez votre nom." }),
  email,
  password: z
    .string()
    .min(8, { error: "Au moins 8 caractères." })
    .max(128, { error: "Au plus 128 caractères." }),
});

export type SignUpInput = z.input<typeof signUpSchema>;

export type SignUpValues = z.output<typeof signUpSchema>;
