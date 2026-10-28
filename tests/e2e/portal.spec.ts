import { expect, test, type Page } from "@playwright/test";

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1280) < 1024;

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

test("login page offers both demo roles and rejects unknown emails", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Try the live demo" })).toBeVisible();
  await page.getByLabel("Email").fill("nobody@nowhere.example");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("No demo account uses this email")).toBeVisible();
  await page.getByLabel("Email").fill("daniel@atlasportal.example");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});

test("admin dashboard shows KPIs, chart and activity", async ({ page }) => {
  await signIn(page, "admin");
  for (const kpi of ["Active clients", "Active users", "Open projects", "Uploads, 30 days"]) await expect(page.getByText(kpi)).toBeVisible();
  await expect(page.locator(".recharts-bar-rectangle").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recent activity" })).toBeVisible();
  await expect(page.getByText("Maya Chen signed in").or(page.getByText(/Maya Chen\s+signed in/)).first()).toBeVisible();
});

test("admin manages users: search, filter, sort, paginate, invite, disable, export", async ({ page }) => {
  await signIn(page, "admin");
  await nav(page, "Users");
  const table = page.getByRole("table");
  await expect(table.getByRole("row")).toHaveCount(11); // header + 10
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText(/Page 2 of \d/)).toBeVisible();

  await page.getByLabel("Search name, email or company").fill("brightline");
  await expect(page.getByText("Jordan Park")).toBeVisible();
  await expect(page.getByText("Page 1 of 1")).toBeVisible();
  await page.getByLabel("Search name, email or company").fill("");

  await page.getByLabel("Role").selectOption("admin");
  await expect(table.getByRole("row")).toHaveCount(5);
  await page.getByRole("button", { name: "Name", exact: true }).click(); // already asc -> desc
  await expect(table.getByRole("row").nth(1)).toContainText("Priya Raman");
  await expect(page.getByRole("columnheader", { name: "Name" })).toHaveAttribute("aria-sort", "descending");

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^users-\d{4}-\d{2}-\d{2}\.csv$/);
  const csv = await (await file.createReadStream()).toArray();
  const text = Buffer.concat(csv).toString("utf8");
  expect(text.split("\r\n").filter(Boolean)).toHaveLength(5);
  expect(text).toContain("maya@atlasportal.example");

  await page.getByLabel("Role").selectOption("");
  await page.getByRole("button", { name: "Invite user" }).click();
  const dialog = page.getByRole("dialog", { name: "Invite user" });
  await dialog.getByLabel("Full name").fill("Robin Test");
  await dialog.getByLabel("Email").fill("jordan.park@brightline.example");
  await dialog.getByLabel("Company").selectOption({ label: "Kestrel Legal LLP" });
  await dialog.getByRole("button", { name: "Send invite" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("A user with this email already exists.");
  await dialog.getByLabel("Email").fill("robin.test@kestrel.example");
  await dialog.getByRole("button", { name: "Send invite" }).click();
  await expect(dialog).toBeHidden();
  await page.getByLabel("Search name, email or company").fill("robin");
  await expect(table.getByRole("row").nth(1)).toContainText("Invited");

  await page.getByRole("button", { name: "Disable Robin Test" }).click();
  await expect(table.getByRole("row").nth(1)).toContainText("Disabled");
  await expect(page.getByRole("button", { name: "Enable Robin Test" })).toBeVisible();
});

test("admin updates a project and sees it in the activity log", async ({ page }) => {
  await signIn(page, "admin");
  await nav(page, "Projects");
  await page.getByRole("table").getByRole("row").nth(1).click();
  const dialog = page.getByRole("dialog");
  const name = (await dialog.getByRole("heading").textContent())!.replace("Update ", "");
  await dialog.getByLabel("Status").selectOption("completed");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Project updated.")).toBeVisible();
  await nav(page, "Activity log");
  await expect(page.getByRole("table").getByRole("row").nth(1)).toContainText("project.update");
  await expect(page.getByRole("table").getByRole("row").nth(1)).toContainText(isMobile(page) ? "Maya Chen" : name);
});

test("client only sees their own company and no admin pages", async ({ page }) => {
  await signIn(page, "client");
  await expect(page.getByRole("heading", { name: "Welcome back, Jordan" })).toBeVisible();
  if (isMobile(page)) await page.getByRole("button", { name: "Open menu" }).click();
  const menu = page.getByRole("navigation", { name: "Main" });
  await expect(menu.getByRole("link", { name: "Users" })).toHaveCount(0);
  await expect(menu.getByRole("link", { name: "Files" })).toBeVisible();
  await page.goto("users/");
  await expect(page.getByText("You don't have access to this page")).toBeVisible();
  await page.goto("projects/");
  await expect(page.getByLabel("Client")).toHaveCount(0);
});

test("file portal: upload, preview, share, download and delete", async ({ page }) => {
  await signIn(page, "client");
  await nav(page, "Files");
  await page.getByRole("button", { name: /^Shared/ }).click();
  const meter = page.getByRole("meter", { name: "Brightline Dental Group storage used" });
  const before = Number(await meter.getAttribute("aria-valuenow"));

  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  await page.getByLabel("Upload files").setInputFiles([
    { name: "site-photo.png", mimeType: "image/png", buffer: png },
    { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("Hello from the e2e test") },
  ]);
  await expect(page.getByRole("progressbar").first()).toBeVisible();
  await expect(page.getByLabel("Uploaded")).toHaveCount(2, { timeout: 10_000 });
  await expect(page.getByRole("button", { name: "Preview site-photo.png" }).or(page.getByRole("button", { name: /site-photo\.png/ })).first()).toBeVisible();
  await expect.poll(async () => Number(await meter.getAttribute("aria-valuenow"))).toBe(before + png.length + 23);

  // Uploading the same name again gets a suffix.
  await page.getByLabel("Upload files").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("again") });
  await expect(page.getByText("notes (1).txt").first()).toBeVisible({ timeout: 10_000 });

  // Image preview
  await page.getByRole("button", { name: /site-photo\.png/ }).first().click();
  const preview = page.getByRole("dialog", { name: "site-photo.png" });
  await expect(preview.getByRole("img", { name: "Preview of site-photo.png" })).toBeVisible();
  await preview.getByRole("button", { name: "Close dialog" }).click();

  // Text preview
  await page.getByRole("button", { name: /^notes\.txt/ }).first().click();
  await expect(page.getByRole("dialog", { name: "notes.txt" }).getByText("Hello from the e2e test")).toBeVisible();
  await page.getByRole("dialog", { name: "notes.txt" }).getByRole("button", { name: "Close dialog" }).click();

  // Share link -> public share page -> download
  await page.getByRole("button", { name: "Share notes.txt" }).click();
  const share = page.getByRole("dialog", { name: "Share notes.txt" });
  await share.getByRole("button", { name: "Create link" }).click();
  const link = await share.getByLabel("Share link").inputValue();
  expect(link).toMatch(/\/share\/#[A-Za-z0-9_-]{16}$/);
  await share.getByRole("button", { name: "Close dialog" }).click();
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "notes.txt" })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download" }).click();
  expect((await download).suggestedFilename()).toBe("notes.txt");

  // Delete revokes the link
  await page.goto("files/");
  await page.getByRole("button", { name: /^Shared/ }).click();
  await page.getByRole("button", { name: "Delete notes.txt" }).click();
  await page.getByRole("dialog", { name: "Delete file?" }).getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("button", { name: "Delete notes.txt" })).toHaveCount(0);
  await page.goto(link);
  await expect(page.getByText("Link unavailable")).toBeVisible();
});

test("client can't delete files uploaded by others, and new folders work", async ({ page }) => {
  await signIn(page, "client");
  await nav(page, "Files");
  const other = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("atlas:state")!);
    const me = localStorage.getItem("atlas:session");
    const file = s.files.find((f: { companyId: string; uploadedBy: string }) => f.companyId === "c-brightline" && f.uploadedBy !== me);
    return { name: file.name as string, folder: s.folders.find((f: { id: string }) => f.id === file.folderId).name as string };
  });
  await page.getByRole("button", { name: new RegExp(`^${other.folder}`) }).click();
  await expect(page.getByRole("button", { name: `Download ${other.name}` })).toBeVisible();
  await expect(page.getByRole("button", { name: `Delete ${other.name}` })).toHaveCount(0);
  await page.getByRole("button", { name: "New folder" }).click();
  const dialog = page.getByRole("dialog", { name: "New folder" });
  await dialog.getByLabel("Folder name").fill("contracts");
  await dialog.getByRole("button", { name: "Create folder" }).click();
  await expect(dialog.getByText("A folder with this name already exists.")).toBeVisible();
  await dialog.getByLabel("Folder name").fill("Briefs");
  await dialog.getByRole("button", { name: "Create folder" }).click();
  await expect(page.getByRole("heading", { name: "Briefs" })).toBeVisible();
  await expect(page.getByText("This folder is empty")).toBeVisible();
});

test("seeded PDFs render a preview on every browser", async ({ page }) => {
  await signIn(page, "client");
  await nav(page, "Files");
  await page.getByRole("button", { name: /^Contracts/ }).click();
  await page.getByRole("button", { name: /\.pdf/ }).first().click();
  await expect(page.getByTestId("pdf-pages").locator("canvas")).toHaveCount(1, { timeout: 15_000 });
});

test("oversized uploads fail with a clear error", async ({ page }) => {
  await signIn(page, "client");
  await nav(page, "Files");
  await page.getByLabel("Upload files").setInputFiles({ name: "huge.bin", mimeType: "application/octet-stream", buffer: Buffer.alloc(26 * 1024 * 1024) });
  await expect(page.getByText("Files are limited to 25 MB in this demo.")).toBeVisible();
});

test("theme choice persists and reset restores demo data", async ({ page }) => {
  await signIn(page, "admin");
  const dark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  await page.getByRole("button", { name: dark ? "Switch to light theme" : "Switch to dark theme" }).click();
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(!dark);

  await nav(page, "Users");
  await page.getByLabel("Search name, email or company").fill("jordan");
  await page.getByRole("button", { name: "Disable Jordan Park" }).click();
  await page.getByRole("button", { name: "Reset demo data" }).first().click();
  await page.getByRole("dialog", { name: "Reset demo data?" }).getByRole("button", { name: "Reset" }).click();
  await expect(page.getByText("Demo data was reset.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Disable Jordan Park" })).toBeVisible();
});

test("unknown share tokens and pages show error states", async ({ page }) => {
  await page.goto("share/#does-not-exist");
  await expect(page.getByText("This link doesn't exist or was revoked.")).toBeVisible();
  const res = await page.goto("no-such-page/");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

for (const role of ["admin", "client"] as const) {
  test(`no page scrolls sideways (${role})`, async ({ page }) => {
    await signIn(page, role);
    const pages = role === "admin" ? ["dashboard/", "clients/", "projects/", "users/", "files/", "activity/", "settings/"] : ["dashboard/", "projects/", "files/", "settings/"];
    for (const path of pages) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
}

test("signed-out visitors are sent to the login page", async ({ page }) => {
  await page.goto("dashboard/");
  await expect(page.getByRole("heading", { name: "Try the live demo" })).toBeVisible();
});
