import { createRouter } from "@tanstack/react-router";

import { authQueries } from "./api/auth/index.ts";
import { createQueryClient } from "./api/query-client.ts";
import { routeTree } from "./routeTree.gen.ts";

// A 401 in the middle of a page: the Session is gone, back to the login page,
// which brings the Utilisateur back here once signed in again.
export const queryClient = createQueryClient(() => {
  queryClient.setQueryData(authQueries.session().queryKey, null);

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
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
