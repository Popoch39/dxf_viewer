import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { loadCurrentUser } from "@/api/auth";
import { AppHeader, AppHeaderSkeleton } from "@/components/app-header";

/** Layout of every page that needs a Session: without one, back to the login page. */
export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    if ((await loadCurrentUser()) === null) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
  pendingComponent: AuthenticatedPending,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader />
      <Outlet />
    </div>
  );
}

// The page below the bar has its own pending state, once the Session is known.
function AuthenticatedPending() {
  return (
    <div className="flex min-h-svh flex-col">
      <AppHeaderSkeleton />
    </div>
  );
}
