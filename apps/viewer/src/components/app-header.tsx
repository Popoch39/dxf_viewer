import { useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import type { ReactNode } from "react";

import { useSignOut } from "@/api/auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useCurrentUser } from "@/store/session-store";

/** Top bar of the signed-in pages: who is connected, and the way out. */
export function AppHeader() {
  const user = useCurrentUser();
  const signOut = useSignOut();
  const navigate = useNavigate();

  return (
    <HeaderBar>
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
        {signOut.isPending ? <Spinner /> : <LogOut aria-hidden />}
        Se déconnecter
      </Button>
    </HeaderBar>
  );
}

/** The top bar while the Session is checked, at the size of the real one. */
export function AppHeaderSkeleton() {
  return (
    <HeaderBar>
      <output aria-label="Chargement" className="flex items-center gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-36" />
      </output>
    </HeaderBar>
  );
}

function HeaderBar({ children }: { children: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-4 border-b px-4 py-2">
      <span className="font-semibold">DXF Viewer</span>
      <div className="flex min-w-0 items-center gap-3">{children}</div>
    </header>
  );
}
