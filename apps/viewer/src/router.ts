import { createRouter } from "@tanstack/react-router";

import { createQueryClient } from "./api/query-client.ts";
import { routeTree } from "./routeTree.gen.ts";
import { useSessionStore } from "./store/session-store.ts";

// A 401 in the middle of a page: the Session is gone, back to the login page,
// which brings the Utilisateur back here once signed in again.
export const queryClient = createQueryClient(() => {
  useSessionStore.getState().signedOut();

  const { pathname, href } = router.state.location;

  if (pathname !== "/login" && pathname !== "/register") {
    void router.navigate({ to: "/login", search: { redirect: href } });
  }
});

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  // TanStack Query owns the cache: every preload goes through it.
  defaultPreloadStaleTime: 0,
  // A route's pendingComponent shows after 150 ms instead of 1 s of blank page;
  // once shown, it stays at least `defaultPendingMinMs` (500 ms), so it never just flashes.
  defaultPendingMs: 150,
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
