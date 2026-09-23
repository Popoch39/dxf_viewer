import { createFileRoute, Link, redirect } from "@tanstack/react-router";

import { authQueries, useSignIn } from "@/api/auth";
import { authSearchSchema } from "@/auth/schemas";
import { AuthPage } from "@/components/auth/auth-page";
import { LoginForm } from "@/components/auth/login-form";

export const Route = createFileRoute("/login")({
  validateSearch: authSearchSchema,
  beforeLoad: async ({ context, search }) => {
    const session = await context.queryClient.ensureQueryData(authQueries.session());

    if (session !== null) {
      throw redirect({ href: search.redirect ?? "/" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const signIn = useSignIn();

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
    </AuthPage>
  );
}
