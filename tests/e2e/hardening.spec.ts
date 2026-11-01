import { expect, test, type Page } from "@playwright/test";

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1280) < 1024;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

async function signIn(page: Page, role: "admin" | "client") {
  await page.goto("./");
  await page.getByRole("button", { name: new RegExp(`Try as ${role}`) }).click();
  await expect(page).toHaveURL(/\/dashboard\/$/);
}

async function nav(page: Page, name: string) {
  if (isMobile(page)) await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

async function uploadAndOpen(page: Page, file: { name: string; mimeType: string; buffer: Buffer }) {
  await page.getByLabel("Upload files").setInputFiles(file);
  await page.getByPlaceholder("Search this folder").fill(file.name);
  await page.getByRole("button", { name: `Preview ${file.name}` }).or(page.getByRole("button", { name: new RegExp(file.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) })).first().click({ timeout: 10_000 });
  return page.getByRole("dialog");
}

test("uploaded SVG and HTML files can't run script: no 'Open in new tab', source shown as text", async ({ page }) => {
  await signIn(page, "client");
  await nav(page, "Files");
  let dialog = await uploadAndOpen(page, { name: "logo.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>localStorage.setItem("pwned","1")</script><rect width="9" height="9"/></svg>') });
  await expect(dialog.getByRole("img", { name: "Preview of logo.svg" })).toBeVisible();
  await expect(dialog.getByRole("link", { name: /Open in new tab/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  dialog = await uploadAndOpen(page, { name: "page.html", mimeType: "text/html", buffer: Buffer.from('<script>localStorage.setItem("pwned","1")</script>') });
  await expect(dialog.getByText('<script>localStorage.setItem("pwned","1")</script>')).toBeVisible();
  // The page source opens as plain text, which a browser never runs.
  const [tab] = await Promise.all([page.context().waitForEvent("page"), dialog.getByRole("link", { name: /Open in new tab/ }).click()]);
  await tab.waitForLoadState();
  expect(await tab.evaluate(() => document.contentType)).toBe("text/plain");
  await tab.close();
  expect(await page.evaluate(() => localStorage.getItem("pwned"))).toBeNull();
});

test("previews go by content: renamed image, binary text, ; separated CSV", async ({ page }) => {
  await signIn(page, "client");
  await nav(page, "Files");
  let dialog = await uploadAndOpen(page, { name: "scan-renamed.pdf", mimeType: "application/pdf", buffer: png });
  await expect(dialog.getByText("This file is a PNG image")).toBeVisible();
  await expect(dialog.getByRole("img", { name: "Preview of scan-renamed.pdf" })).toBeVisible();
  await page.keyboard.press("Escape");
  dialog = await uploadAndOpen(page, { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from(Array.from({ length: 3000 }, (_, i) => (i * 7919 + 13) % 256)) });
  await expect(dialog.getByText("This file isn't readable text")).toBeVisible();
  await page.keyboard.press("Escape");
  dialog = await uploadAndOpen(page, { name: "umsatz.csv", mimeType: "text/csv", buffer: Buffer.from('﻿Datum;Kunde;Betrag\n02.10.2026;"Schmidt; Söhne";99,00\n') });
  await expect(dialog.getByRole("cell", { name: "Schmidt; Söhne" })).toBeVisible();
  await expect(dialog.getByRole("cell", { name: "99,00" })).toBeVisible();
});

test("empty files and unusable names are refused before upload", async ({ page }) => {
  await signIn(page, "client");
  await nav(page, "Files");
  await page.getByLabel("Upload files").setInputFiles({ name: "empty.txt", mimeType: "text/plain", buffer: Buffer.alloc(0) });
  await expect(page.getByText("This file is empty.")).toBeVisible();
});

test("clients can't revoke a link an admin created", async ({ page }) => {
  await signIn(page, "admin");
  await nav(page, "Files");
  await page.getByLabel("Client").selectOption({ label: "Brightline Dental Group" });
  const name = (await page.getByRole("button", { name: /^Share / }).first().getAttribute("aria-label"))!.replace(/^Share /, "");
  await page.getByRole("button", { name: `Share ${name}` }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Create link" }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Revoke link" })).toHaveCount(1);
  await page.keyboard.press("Escape");
  await page.evaluate(() => localStorage.removeItem("atlas:session"));
  await signIn(page, "client");
  await nav(page, "Files");
  await page.getByRole("button", { name: `Share ${name}` }).first().click();
  await expect(page.getByRole("dialog").getByLabel("Share link")).toHaveCount(1);
  await expect(page.getByRole("dialog").getByRole("button", { name: "Revoke link" })).toHaveCount(0);
});

test("pausing a client signs its users out and blocks sign-in", async ({ page }) => {
  await signIn(page, "client");
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("atlas:state")!);
    const me = s.users.find((u: { id: string }) => u.id === localStorage.getItem("atlas:session"));
    s.companies.find((c: { id: string }) => c.id === me.companyId).status = "paused";
    localStorage.setItem("atlas:state", JSON.stringify(s));
  });
  await page.reload();
  await expect(page).toHaveURL(/\/admin-file-portal\/$|\/$/);
  await expect(page.getByRole("button", { name: /Try as client/ })).toBeDisabled();
  await page.getByLabel("Email").fill("jordan.park@brightline.example");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("This client's portal is paused.", { exact: false })).toBeVisible();
});
