import { createFileRoute, Link, redirect } from "@tanstack/react-router";

import { authQueries, useSignUp } from "@/api/auth";
import { authSearchSchema } from "@/auth/schemas";
import { AuthPage } from "@/components/auth/auth-page";
import { RegisterForm } from "@/components/auth/register-form";

export const Route = createFileRoute("/register")({
  validateSearch: authSearchSchema,
  beforeLoad: async ({ context, search }) => {
    const session = await context.queryClient.ensureQueryData(authQueries.session());

    if (session !== null) {
      throw redirect({ href: search.redirect ?? "/" });
    }
  },
  component: RegisterPage,
});

function RegisterPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const signUp = useSignUp();

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
    </AuthPage>
  );
}
