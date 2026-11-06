import { expect, test, type Page } from "@playwright/test";

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1280) < 1024;
const misses = (page: Page) => page.evaluate(() => [...((window as unknown as { __i18nMisses?: Set<string> }).__i18nMisses ?? [])]);

async function nav(page: Page, name: string) {
  if (isMobile(page)) await page.getByRole("button", { name: "Menüyü aç" }).click();
  await page.getByRole("navigation", { name: "Ana menü" }).getByRole("link", { name }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

test("the portal works in Turkish for an admin", async ({ page }) => {
  await page.goto("./?lang=tr");
  await expect(page.getByRole("heading", { name: "Canlı demoyu deneyin" })).toBeVisible();
  await page.getByRole("button", { name: /yönetici olarak dene/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Panel" })).toBeVisible();
  for (const name of ["Projeler", "Dosyalar", "Müşteriler", "Kullanıcılar", "Etkinlik kaydı", "Ayarlar"]) await nav(page, name);
  await nav(page, "Kullanıcılar");
  await expect(page.getByRole("columnheader", { name: /Rol/ })).toBeVisible();
  expect(await misses(page)).toEqual([]);
});

test("the client portal works in Turkish", async ({ page }) => {
  await page.goto("./?lang=tr");
  await page.getByRole("button", { name: /müşteri olarak dene/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Panel" })).toBeVisible();
  await nav(page, "Dosyalar");
  await expect(page.getByText(/kullanıldı · .* planı/)).toBeVisible();
  expect(await misses(page)).toEqual([]);
});

test("the palette switches the language", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: /Try as admin/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  await page.keyboard.press(isMobile(page) ? "Control+k" : "Control+k");
  const input = page.getByPlaceholder("Search pages, clients, projects, people, files…");
  if (!(await input.isVisible())) await page.getByRole("button", { name: "Search" }).first().click();
  await input.fill("türkçe");
  await input.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Panel" })).toBeVisible();
});
