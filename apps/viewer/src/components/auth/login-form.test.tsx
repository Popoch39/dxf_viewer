import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ApiRequestError } from "@/api/client";

import { LoginForm } from "./login-form";

function renderForm(error: Error | null = null) {
  const onSubmit = vi.fn<(email: string, password: string) => void>();
  render(<LoginForm onSubmit={onSubmit} pending={false} error={error} />);

  return { onSubmit, user: userEvent.setup() };
}

describe("LoginForm", () => {
  it("submits the email and the password", async () => {
    const { onSubmit, user } = renderForm();

    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Mot de passe"), "correct horse");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("ada@example.com", "correct horse");
  });

  it("refuses an invalid email without submitting", async () => {
    const { onSubmit, user } = renderForm();

    await user.type(screen.getByLabelText("Email"), "ada");
    await user.type(screen.getByLabelText("Mot de passe"), "correct horse");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));

    expect(screen.getByText("Adresse email invalide.")).toBeDefined();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("refuses an empty password without submitting", async () => {
    const { onSubmit, user } = renderForm();

    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));

    expect(screen.getByText("Saisissez votre mot de passe.")).toBeDefined();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("explains wrong credentials", () => {
    renderForm(new ApiRequestError(401, { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid" }));

    expect(screen.getByRole("alert").textContent).toBe("Email ou mot de passe incorrect.");
  });

  it("blocks a second submit while signing in", () => {
    render(<LoginForm onSubmit={vi.fn()} pending error={null} />);

    expect(screen.getByRole("button", { name: "Se connecter" }).hasAttribute("disabled")).toBe(
      true,
    );
  });

  it("lets the password be shown", async () => {
    const { user } = renderForm();

    await user.click(screen.getByRole("button", { name: "Afficher le mot de passe" }));

    expect(screen.getByLabelText("Mot de passe").getAttribute("type")).toBe("text");
  });
});
