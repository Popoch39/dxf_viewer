import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createAuthClient } from "better-auth/client";

import type { SignInValues, SignUpValues } from "@/auth/schemas";
import { env } from "@/env";

import { ApiRequestError } from "../client";

// Better Auth routes are a raw handler on the API, which Eden cannot type: its
// own client calls them. The session is a cookie set on the API's origin.
const authClient = createAuthClient({
  baseURL: `${env.apiUrl}/api/auth`,
  fetchOptions: { credentials: "include" },
});

interface AuthFailure {
  status: number;
  code?: string | undefined;
  message?: string | undefined;
}

type AuthResult<Data> = { data: Data; error: null } | { data: null; error: AuthFailure };

/** Resolves a Better Auth call to its data, or throws an `ApiRequestError` like `unwrap()`. */
async function unwrapAuth<Data>(request: Promise<AuthResult<Data>>): Promise<Data> {
  const result = await request;

  if (result.error === null) {
    return result.data;
  }

  const { status, code, message } = result.error;

  throw new ApiRequestError(status, {
    code: code ?? "UNEXPECTED_RESPONSE",
    message: message ?? `HTTP ${status}`,
  });
}

export const authQueries = {
  all: () => ["auth"] as const,
  /** The current Session and its Utilisateur, or `null` when signed out. */
  session: () =>
    queryOptions({
      queryKey: [...authQueries.all(), "session"],
      queryFn: () => unwrapAuth(authClient.getSession()),
    }),
};

export function useSession() {
  return useQuery(authQueries.session());
}

export function useSignIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: SignInValues) => unwrapAuth(authClient.signIn.email(credentials)),
    // Awaited, so that the next route reads the new Session and not the cached `null`.
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: authQueries.all(), refetchType: "all" }),
  });
}

export function useSignUp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (registration: SignUpValues) => unwrapAuth(authClient.signUp.email(registration)),
    // The API signs the new Utilisateur in right away.
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: authQueries.all(), refetchType: "all" }),
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => unwrapAuth(authClient.signOut()),
    // Nothing cached belongs to the next Utilisateur of this browser.
    onSuccess: () => {
      queryClient.clear();
      queryClient.setQueryData(authQueries.session().queryKey, null);
    },
  });
}
