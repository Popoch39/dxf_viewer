import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";

import { type SignUpInput, signUpSchema, type SignUpValues } from "@/auth/schemas";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

import { AuthFormError } from "./auth-form-error";
import { PasswordInput } from "./password-input";

interface RegisterFormProps {
  onSubmit: (name: string, email: string, password: string) => void;
  pending: boolean;
  /** Failure of the last attempt, explained under the form. */
  error: Error | null;
}

export function RegisterForm({ onSubmit, pending, error }: RegisterFormProps) {
  const form = useForm<SignUpInput, unknown, SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  return (
    <form
      noValidate
      onSubmit={(event) => {
        void form.handleSubmit((values) => {
          onSubmit(values.name, values.email, values.password);
        })(event);
      }}
    >
      <FieldGroup>
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="register-name">Nom</FieldLabel>
              <Input
                {...field}
                id="register-name"
                autoComplete="name"
                aria-invalid={fieldState.invalid}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="register-email">Email</FieldLabel>
              <Input
                {...field}
                id="register-email"
                type="email"
                autoComplete="email"
                spellCheck={false}
                aria-invalid={fieldState.invalid}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="register-password">Mot de passe</FieldLabel>
              <PasswordInput
                {...field}
                id="register-password"
                autoComplete="new-password"
                aria-invalid={fieldState.invalid}
                aria-describedby="register-password-hint"
              />
              {fieldState.invalid ? (
                <FieldError errors={[fieldState.error]} />
              ) : (
                <FieldDescription
                  id="register-password-hint"
                  className="text-xs leading-4 last:-mt-1"
                >
                  8 caractères minimum.
                </FieldDescription>
              )}
            </Field>
          )}
        />
        <div className="flex flex-col gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            S'inscrire
          </Button>
          <AuthFormError error={error} />
        </div>
      </FieldGroup>
    </form>
  );
}
