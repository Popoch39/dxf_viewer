import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { authQueries } from "@/api/auth";
import { AppHeader } from "@/components/app-header";

/** Layout of every page that needs a Session: without one, back to the login page. */
export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData(authQueries.session());

    if (session === null) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
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
