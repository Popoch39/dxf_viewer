import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { loadCurrentUser, useSignUp } from "@/api/auth";
import { authSearchSchema } from "@/auth/schemas";
import { AuthFormSkeleton } from "@/components/auth/auth-form-skeleton";
import { AuthPage } from "@/components/auth/auth-page";
import { RegisterForm } from "@/components/auth/register-form";

export const Route = createFileRoute("/register")({
  validateSearch: authSearchSchema,
  beforeLoad: async ({ search }) => {
    if ((await loadCurrentUser()) !== null) {
      throw redirect({ href: search.redirect ?? "/" });
    }
  },
  pendingComponent: RegisterPending,
  component: RegisterPage,
});

function RegisterPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const signUp = useSignUp();

  return (
    <RegisterCard>
      <RegisterForm
        pending={signUp.isPending}
        error={signUp.error}
        onSubmit={(name, email, password) => {
          signUp.mutate(
            { name, email, password },
            {
              onSuccess: () => {
                void navigate({ href: search.redirect ?? "/" });
              },
            },
          );
        }}
      />
    </RegisterCard>
  );
}

/** While the Session is checked: the same card, the form still to come. */
function RegisterPending() {
  return (
    <RegisterCard>
      <AuthFormSkeleton fields={["Nom", "Email", "Mot de passe"]} />
    </RegisterCard>
  );
}

function RegisterCard({ children }: { children: ReactNode }) {
  const search = Route.useSearch();

  return (
    <AuthPage
      title="Inscription"
      description="Inscrivez-vous pour importer et consulter vos Dessins."
      footer={
        <p>
          Déjà inscrit ?{" "}
          <Link
            to="/login"
            search={search}
            className="text-foreground underline underline-offset-4"
          >
            Se connecter
          </Link>
        </p>
      }
    >
      {children}
    </AuthPage>
  );
}
