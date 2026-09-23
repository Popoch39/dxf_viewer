import { useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";

import { useSignOut } from "@/api/auth";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/store/session-store";

/** Top bar of the signed-in pages: who is connected, and the way out. */
export function AppHeader() {
  const user = useCurrentUser();
  const signOut = useSignOut();
  const navigate = useNavigate();

  return (
    <header className="flex items-center justify-between gap-4 border-b px-4 py-2">
      <span className="font-semibold">DXF Viewer</span>
      <div className="flex min-w-0 items-center gap-3">
        {user ? <span className="truncate text-sm text-muted-foreground">{user.name}</span> : null}
        <Button
          variant="outline"
          size="sm"
          disabled={signOut.isPending}
          onClick={() => {
            signOut.mutate(undefined, {
              onSuccess: () => {
                void navigate({ to: "/login" });
              },
            });
          }}
        >
          <LogOut aria-hidden />
          Se déconnecter
        </Button>
      </div>
    </header>
  );
}
