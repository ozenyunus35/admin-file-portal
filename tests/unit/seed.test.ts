import { describe, expect, it } from "vitest";
import { storageUsed } from "@/lib/api";
import { DEMO_ADMIN_ID, DEMO_CLIENT_ID, createSeed } from "@/lib/seed";

const NOW = new Date("2026-10-28T12:00:00Z");

describe("createSeed", () => {
  const s = createSeed(NOW);

  it("is deterministic for the same date", () => {
    expect(createSeed(NOW)).toEqual(s);
  });

  it("only uses reserved .example email domains", () => {
    for (const u of s.users) expect(u.email).toMatch(/@[a-z]+\.example$/);
  });

  it("has unique ids and emails", () => {
    for (const list of [s.users, s.companies, s.projects, s.folders, s.files, s.activity]) {
      const ids = list.map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
    expect(new Set(s.users.map((u) => u.email)).size).toBe(s.users.length);
  });

  it("includes both active demo accounts", () => {
    const admin = s.users.find((u) => u.id === DEMO_ADMIN_ID)!;
    const client = s.users.find((u) => u.id === DEMO_CLIENT_ID)!;
    expect(admin).toMatchObject({ role: "admin", status: "active", companyId: null });
    expect(client).toMatchObject({ role: "client", status: "active" });
    expect(s.files.some((f) => f.companyId === client.companyId)).toBe(true);
  });

  it("keeps references consistent", () => {
    const companyIds = new Set(s.companies.map((c) => c.id));
    const folderById = new Map(s.folders.map((f) => [f.id, f]));
    for (const f of s.files) {
      expect(folderById.get(f.folderId)?.companyId).toBe(f.companyId);
      expect(s.users.some((u) => u.id === f.uploadedBy)).toBe(true);
    }
    for (const p of s.projects) expect(companyIds.has(p.companyId)).toBe(true);
    for (const u of s.users) if (u.role === "client") expect(companyIds.has(u.companyId!)).toBe(true);
  });

  it("keeps every client inside its storage quota", () => {
    for (const c of s.companies) expect(storageUsed(s, c.id)).toBeLessThan(c.quota);
  });

  it("dates files within the last 30 days and never in the future", () => {
    for (const f of s.files) {
      const age = NOW.getTime() - Date.parse(f.createdAt);
      expect(age).toBeGreaterThanOrEqual(0);
      expect(age).toBeLessThan(31 * 86_400_000);
    }
  });

  it("sorts activity newest first", () => {
    const times = s.activity.map((a) => a.at);
    expect([...times].sort().reverse()).toEqual(times);
  });
});
