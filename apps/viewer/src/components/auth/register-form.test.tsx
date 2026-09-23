import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ApiRequestError } from "@/api/client";

import { RegisterForm } from "./register-form";

function renderForm(error: Error | null = null) {
  const onSubmit = vi.fn<(name: string, email: string, password: string) => void>();
  render(<RegisterForm onSubmit={onSubmit} pending={false} error={error} />);

  return { onSubmit, user: userEvent.setup() };
}

describe("RegisterForm", () => {
  it("submits the trimmed name, the email and the password", async () => {
    const { onSubmit, user } = renderForm();

    await user.type(screen.getByLabelText("Nom"), "  Ada Lovelace ");
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Mot de passe"), "correct horse");
    await user.click(screen.getByRole("button", { name: "S'inscrire" }));

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith(
      "Ada Lovelace",
      "ada@example.com",
      "correct horse",
    );
  });

  it("refuses a blank name without submitting", async () => {
    const { onSubmit, user } = renderForm();

    await user.type(screen.getByLabelText("Nom"), "   ");
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Mot de passe"), "correct horse");
    await user.click(screen.getByRole("button", { name: "S'inscrire" }));

    expect(screen.getByText("Saisissez votre nom.")).toBeDefined();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("refuses a password shorter than 8 characters without submitting", async () => {
    const { onSubmit, user } = renderForm();

    await user.type(screen.getByLabelText("Nom"), "Ada");
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Mot de passe"), "1234567");
    await user.click(screen.getByRole("button", { name: "S'inscrire" }));

    expect(screen.getByText("Au moins 8 caractères.")).toBeDefined();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("explains an email already in use", () => {
    renderForm(new ApiRequestError(422, { code: "USER_ALREADY_EXISTS", message: "Exists" }));

    expect(screen.getByRole("alert").textContent).toBe(
      "Un Utilisateur existe déjà avec cet email.",
    );
  });
});
