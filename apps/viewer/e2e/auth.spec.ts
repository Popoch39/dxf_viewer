import { expect, type Page, test } from "@playwright/test";

const PASSWORD = "correct horse battery staple";

function uniqueEmail(): string {
  return `e2e-${crypto.randomUUID()}@example.com`;
}

async function register(page: Page, name: string, email: string): Promise<void> {
  await page.goto("/register");
  await page.getByLabel("Nom").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "S'inscrire" }).click();
}

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

test("without a Session, the home page sends to the login page", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL("/login?redirect=%2F");
  await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
});

test("a new Utilisateur is signed in once registered, and stays so after a reload", async ({
  page,
}) => {
  await register(page, "Ada Lovelace", uniqueEmail());

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("banner").getByText("Ada Lovelace")).toBeVisible();

  await page.reload();

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("banner").getByText("Ada Lovelace")).toBeVisible();
});

test("signing out ends the Session", async ({ page }) => {
  await register(page, "Ada", uniqueEmail());
  await expect(page).toHaveURL("/");

  await page.getByRole("button", { name: "Se déconnecter" }).click();

  await expect(page).toHaveURL("/login");

  await page.goto("/");

  await expect(page).toHaveURL("/login?redirect=%2F");
});

test("signing in brings back to the page asked for", async ({ page }) => {
  const email = uniqueEmail();
  await register(page, "Ada", email);
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL("/login");

  await page.goto("/");
  await signIn(page, email, PASSWORD);

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("banner").getByText("Ada")).toBeVisible();
});

test("wrong credentials are explained", async ({ page }) => {
  const email = uniqueEmail();
  await register(page, "Ada", email);
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL("/login");

  await signIn(page, email, "not the password");

  await expect(page.getByText("Email ou mot de passe incorrect.")).toBeVisible();
  await expect(page).toHaveURL("/login");
});

test("an email already in use is refused", async ({ page, browser }) => {
  const email = uniqueEmail();
  await register(page, "Ada", email);
  await expect(page).toHaveURL("/");

  // Another browser, without the first Utilisateur's Session.
  const context = await browser.newContext();
  const other = await context.newPage();
  await register(other, "Grace", email);

  await expect(other.getByText("Un Utilisateur existe déjà avec cet email.")).toBeVisible();
  await context.close();
});

test("a signed-in Utilisateur skips the login page", async ({ page }) => {
  await register(page, "Ada", uniqueEmail());
  await expect(page).toHaveURL("/");

  await page.goto("/login");

  await expect(page).toHaveURL("/");
});
