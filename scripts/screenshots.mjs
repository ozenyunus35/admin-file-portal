// Captures the README screenshots from the static build.
// Usage: PAGES_BASE_PATH=/admin-file-portal npm run build && npm run serve & node scripts/screenshots.mjs
import { chromium, devices } from "@playwright/test";

const BASE = process.env.SHOT_URL ?? "http://localhost:4173/admin-file-portal/";
const browser = await chromium.launch();

async function session(role, opts) {
  const ctx = await browser.newContext({ colorScheme: "dark", ...opts });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.getByRole("button", { name: `Try as ${role}` }).click();
  await page.waitForURL(/dashboard/);
  return { ctx, page };
}

const settle = (page) => page.waitForTimeout(700);

{
  const ctx = await browser.newContext({ colorScheme: "dark", viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await settle(page);
  await page.screenshot({ path: "docs/login.png" });
  await ctx.close();
}

{
  const { ctx, page } = await session("admin", { viewport: { width: 1440, height: 900 } });
  await settle(page);
  await page.screenshot({ path: "docs/dashboard.png" });
  await page.goto(BASE + "users/");
  await settle(page);
  await page.screenshot({ path: "docs/users.png" });
  await page.goto(BASE + "files/");
  await page.getByRole("button", { name: /^Design/ }).click();
  await page.getByRole("button", { name: /Homepage mockup/ }).first().click().catch(() => page.getByRole("button", { name: /\.svg/ }).first().click());
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "docs/preview.png" });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^Contracts/ }).click();
  await settle(page);
  await page.screenshot({ path: "docs/files.png" });
  await ctx.close();
}

{
  const { ctx, page } = await session("client", { ...devices["iPhone 15"] });
  await settle(page);
  await page.screenshot({ path: "docs/mobile.png" });
  await page.goto(BASE + "files/");
  await settle(page);
  await page.screenshot({ path: "docs/mobile-files.png" });
  await ctx.close();
}

await browser.close();
console.log("Saved screenshots to docs/");
