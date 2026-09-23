import { createRouter } from "@tanstack/react-router";

import { queryClient } from "./api/query-client.ts";
import { routeTree } from "./routeTree.gen.ts";

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
