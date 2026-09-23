import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createAuthClient } from "better-auth/client";

import type { SignInValues, SignUpValues } from "@/auth/schemas";
import { env } from "@/env";
import { useSessionStore } from "@/store/session-store";

import { ApiRequestError } from "../client";

// Better Auth routes are a raw handler on the API, which Eden cannot type: its
// own client calls them. The session is a cookie set on the API's origin.
const authClient = createAuthClient({
  baseURL: `${env.apiUrl}/api/auth`,
  fetchOptions: { credentials: "include" },
});

export type User = (typeof authClient.$Infer.Session)["user"];

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

/** Like `unwrapAuth()`, for a call whose success always carries data. */
async function unwrapAuthData<Data>(request: Promise<AuthResult<Data | null>>): Promise<Data> {
  const data = await unwrapAuth(request);

  if (data === null) {
    throw new ApiRequestError(502, { code: "UNEXPECTED_RESPONSE", message: "Empty auth response" });
  }

  return data;
}

let pendingSession: Promise<void> | null = null;

async function askSession(): Promise<void> {
  try {
    const session = await unwrapAuth(authClient.getSession());
    const { signedIn, signedOut } = useSessionStore.getState();

    if (session === null) {
      signedOut();
    } else {
      signedIn(session.user);
    }
  } finally {
    pendingSession = null;
  }
}

/**
 * The signed-in Utilisateur, or `null`. The API is asked once per page load
 * (concurrent callers share the request); the session store answers afterwards.
 */
export async function loadCurrentUser(): Promise<User | null> {
  if (!useSessionStore.getState().loaded) {
    pendingSession ??= askSession();
    await pendingSession;
  }

  return useSessionStore.getState().user;
}

export function useSignIn() {
  return useMutation({
    mutationFn: (credentials: SignInValues) => unwrapAuthData(authClient.signIn.email(credentials)),
    onSuccess: (result) => {
      useSessionStore.getState().signedIn(result.user);
    },
  });
}

export function useSignUp() {
  return useMutation({
    mutationFn: (registration: SignUpValues) =>
      unwrapAuthData(authClient.signUp.email(registration)),
    // The API signs the new Utilisateur in right away.
    onSuccess: (result) => {
      useSessionStore.getState().signedIn(result.user);
    },
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => unwrapAuth(authClient.signOut()),
    // Nothing cached belongs to the next Utilisateur of this browser.
    onSuccess: () => {
      queryClient.clear();
      useSessionStore.getState().signedOut();
    },
  });
}
