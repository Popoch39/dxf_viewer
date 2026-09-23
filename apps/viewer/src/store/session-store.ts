import { create } from "zustand";

import type { User } from "@/api/auth";

interface SessionState {
  /** `false` until the API has been asked whether a Session exists. */
  loaded: boolean;
  /** The signed-in Utilisateur, `null` without a Session. */
  user: User | null;
  signedIn: (user: User) => void;
  signedOut: () => void;
}

/**
 * The only owner of the signed-in Utilisateur on the client. The Session itself
 * is a cookie of the API: this store is filled from the API's answers, by
 * `src/api/auth/`, and read everywhere else.
 */
export const useSessionStore = create<SessionState>()((set) => ({
  loaded: false,
  user: null,
  signedIn: (user) => {
    set({ loaded: true, user });
  },
  signedOut: () => {
    set({ loaded: true, user: null });
  },
}));

export function useCurrentUser(): User | null {
  return useSessionStore((state) => state.user);
}
