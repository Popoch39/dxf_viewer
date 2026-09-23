import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { loadCurrentUser, useSignIn } from "@/api/auth";
import { authSearchSchema } from "@/auth/schemas";
import { AuthFormSkeleton } from "@/components/auth/auth-form-skeleton";
import { AuthPage } from "@/components/auth/auth-page";
import { LoginForm } from "@/components/auth/login-form";

export const Route = createFileRoute("/login")({
  validateSearch: authSearchSchema,
  beforeLoad: async ({ search }) => {
    if ((await loadCurrentUser()) !== null) {
      throw redirect({ href: search.redirect ?? "/" });
    }
  },
  pendingComponent: LoginPending,
  component: LoginPage,
});

function LoginPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const signIn = useSignIn();

  return (
    <LoginCard>
      <LoginForm
        pending={signIn.isPending}
        error={signIn.error}
        onSubmit={(email, password) => {
          signIn.mutate(
            { email, password },
            {
              onSuccess: () => {
                void navigate({ href: search.redirect ?? "/" });
              },
            },
          );
        }}
      />
    </LoginCard>
  );
}

/** While the Session is checked: the same card, the form still to come. */
function LoginPending() {
  return (
    <LoginCard>
      <AuthFormSkeleton fields={["Email", "Mot de passe"]} />
    </LoginCard>
  );
}

function LoginCard({ children }: { children: ReactNode }) {
  const search = Route.useSearch();

  return (
    <AuthPage
      title="Connexion"
      description="Connectez-vous pour retrouver vos Dessins."
      footer={
        <p>
          Pas encore inscrit ?{" "}
          <Link
            to="/register"
            search={search}
            className="text-foreground underline underline-offset-4"
          >
            S'inscrire
          </Link>
        </p>
      }
    >
      {children}
    </AuthPage>
  );
}
