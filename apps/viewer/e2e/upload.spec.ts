import { fileURLToPath } from "node:url";

import { expect, type Page, test } from "@playwright/test";

const FIXTURES = new URL("../../../packages/dxf/test/fixtures/", import.meta.url);

function fixture(name: string): string {
  return fileURLToPath(new URL(name, FIXTURES));
}

async function registerNewUser(page: Page): Promise<void> {
  await page.goto("/register");
  await page.getByLabel("Nom").fill("Ada");
  await page.getByLabel("Email").fill(`e2e-${crypto.randomUUID()}@example.com`);
  await page.getByLabel("Mot de passe", { exact: true }).fill("correct horse battery staple");
  await page.getByRole("button", { name: "S'inscrire" }).click();
  await expect(page).toHaveURL("/");
}

test("an uploaded DXF becomes a ready Dessin, which can be deleted", async ({ page }) => {
  await registerNewUser(page);
  await expect(page.getByText("Aucun Dessin pour l'instant.")).toBeVisible();

  await page.getByLabel("Fichiers DXF").setInputFiles(fixture("r2000-with-blocks.dxf"));

  const card = page.getByLabel("r2000-with-blocks", { exact: true });
  await expect(card.getByText(/DXF R2000 · \d+ entités/)).toBeVisible();

  await page.reload();
  await expect(card.getByText(/DXF R2000/)).toBeVisible();

  await card.getByRole("button", { name: "Supprimer r2000-with-blocks" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Supprimer" }).click();

  await expect(card).toHaveCount(0);
  await expect(page.getByText("Aucun Dessin pour l'instant.")).toBeVisible();
});

test("an invalid DXF ends in a failed Parsing", async ({ page }) => {
  await registerNewUser(page);

  await page.getByLabel("Fichiers DXF").setInputFiles(fixture("corrupt.dxf"));

  const card = page.getByLabel("corrupt", { exact: true });
  await expect(card).toHaveAttribute("data-state", "error");
  await expect(card.getByRole("button", { name: "Supprimer corrupt" })).toBeVisible();
});

test("several files upload at once; a file that is not a DXF is refused", async ({ page }) => {
  await registerNewUser(page);

  await page
    .getByLabel("Fichiers DXF")
    .setInputFiles([
      fixture("r12-without-blocks.dxf"),
      fixture("r2018-nested-blocks.dxf"),
      fixture("generate.py"),
    ]);

  await expect(
    page.getByLabel("generate.py").getByText("Ce fichier n'est pas un DXF."),
  ).toBeVisible();
  await expect(page.getByLabel("r12-without-blocks").getByText(/entités?$/)).toBeVisible();
  await expect(page.getByLabel("r2018-nested-blocks").getByText(/entités?$/)).toBeVisible();

  await page.getByRole("button", { name: "Fermer generate.py" }).click();

  await expect(page.getByLabel("generate.py")).toHaveCount(0);
});
