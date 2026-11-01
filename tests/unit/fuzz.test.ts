// Random sequences of API calls by random users (including disabled ones, clients of
// paused companies and stale sessions) with random, often broken, input. After each call
// that succeeds, the rules a real server must keep are checked. The inputs are not the
// cases the hardening tests were written from.
import { expect, it } from "vitest";
import * as current from "@/lib/api";
import { mulberry32, createSeed } from "@/lib/seed";
import type { DemoState, User } from "@/lib/types";

type Api = typeof current;

export function fuzz(api: Pick<Api, "createUser" | "updateUser" | "setUserStatus" | "updateCompany" | "updateProject" | "createFolder" | "addFile" | "deleteFile" | "createShare" | "revokeShare" | "resolveShare" | "MAX_UPLOAD_BYTES">, seed: number, steps = 300) {
  const rng = mulberry32(seed);
  const pick = <T,>(a: readonly T[]): T => a[Math.floor(rng() * a.length)];
  let s: DemoState = createSeed(new Date("2026-10-28T12:00:00Z"), seed);
  const stale: User[] = [];
  const violations: string[] = [];
  let ok = 0;
  const allowed = (st: DemoState, actor: User) => {
    const u = st.users.find((x) => x.id === actor.id);
    if (!u || u.status === "disabled") return null;
    if (u.role === "client" && st.companies.find((c) => c.id === u.companyId)?.status === "paused") return null;
    return u;
  };
  const NAMES = ["Report.pdf", "", "  ", "..", "../../x.pdf", "a\u0000b.txt", "x".repeat(400) + ".pdf", "Fatura Şubat ✓.pdf", "photo.HEIC", "inv‮fdp.exe", "a/b", "ok.csv"];
  const SIZES = [0, -1, NaN, 1.5, 10, 4096, 1e6, 25 * 1024 ** 2, 25 * 1024 ** 2 + 1, Infinity];
  for (let i = 0; i < steps; i++) {
    const actor = rng() < 0.15 && stale.length ? pick(stale) : pick(s.users);
    if (rng() < 0.1) stale.push({ ...actor });
    const real = allowed(s, actor);
    const before = s;
    const op = pick(["user", "status", "company", "project", "folder", "file", "delete", "share", "revoke"] as const);
    let target: string | null = null;
    try {
      if (op === "user") s = api.createUser(s, actor, { name: pick(["Al", "  ", "x".repeat(90), "New Person"]), email: pick(["a@b.c", " n@x.example ", "bad", `p${i}@x.example`, "a@b..co"]), role: pick(["admin", "client"] as const), title: "", companyId: pick([null, ...s.companies.map((c) => c.id)]) });
      else if (op === "status") s = api.setUserStatus(s, actor, pick(s.users).id, pick(["active", "disabled"] as const));
      else if (op === "company") {
        const c = pick(s.companies);
        target = c.id;
        s = api.updateCompany(s, actor, c.id, pick([{ status: pick(["active", "paused", "onboarding"] as const) }, { quota: pick([-1, 0, NaN, 1, 2 * 1024 ** 3, 25 * 1024 ** 4]) }, { plan: "Gold" as never }]));
      } else if (op === "project") {
        const p = pick(s.projects);
        s = api.updateProject(s, actor, p.id, pick([{ progress: pick([NaN, 33.3, -1, 0, 55, 100, 101]) }, { status: pick(["completed", "active", "zzz"] as never[]) }, { ownerId: pick(s.users).id }, { dueDate: pick(["2000-01-01", "garbage", "2027-05-01"]) }]));
      } else if (op === "folder") {
        const c = pick(s.companies);
        target = c.id;
        s = api.createFolder(s, actor, c.id, pick(["Docs", ".", "", "a\u0007b", `F${i}`])).state;
      } else if (op === "file") {
        const f = pick(s.folders);
        target = f.companyId;
        s = api.addFile(s, actor, { id: rng() < 0.1 ? pick(s.files).id : `file-${i}`, folderId: f.id, name: pick(NAMES), mime: "", size: pick(SIZES) });
      } else if (op === "delete") {
        const f = pick(s.files);
        target = f.companyId;
        s = api.deleteFile(s, actor, f.id);
      } else if (op === "share") {
        const f = pick(s.files);
        target = f.companyId;
        s = api.createShare(s, actor, f.id, pick([1, 7, 30, 3])).state;
      } else if (op === "revoke") {
        if (!s.shares.length) continue;
        const sh = pick(s.shares);
        target = before.files.find((f) => f.id === sh.fileId)?.companyId ?? null;
        s = api.revokeShare(s, actor, sh.id);
        if (real?.role === "client" && sh.createdBy !== real.id) violations.push(`client revoked someone else's link`);
      }
    } catch {
      continue;
    }
    ok++;
    const v = (m: string) => violations.push(`${op}: ${m}`);
    if (!real) v("acted while disabled or paused");
    else if (real.role === "client" && target && target !== real.companyId) v("client touched another company");
    if (real && real.role !== "admin" && ["user", "status", "company", "project"].includes(op)) v("client did an admin action");
    // Seeded files carry simulated sizes; only new uploads must respect the upload rules.
    for (const f of s.files.filter((x) => !before.files.some((b) => b.id === x.id))) {
      if (!Number.isSafeInteger(f.size) || f.size <= 0 || f.size > api.MAX_UPLOAD_BYTES) v(`bad size ${f.size}`);
      if (!f.name.trim() || /[\p{Cc}\\/‪-‮]/u.test(f.name) || f.name.length > 180 || /^\.+$/.test(f.name)) v(`bad name ${JSON.stringify(f.name.slice(0, 30))}`);
    }
    if (new Set(s.files.map((f) => f.id)).size !== s.files.length) v("duplicate file id");
    for (const c of s.companies) {
      if (!(c.quota > 0) || !Number.isSafeInteger(c.quota)) v(`bad quota ${c.quota}`);
      else if (op === "company" && target === c.id && s.files.filter((f) => f.companyId === c.id).reduce((a, f) => a + f.size, 0) > c.quota) v("quota below usage");
      if (!["Starter", "Growth", "Enterprise"].includes(c.plan)) v(`bad plan ${c.plan}`);
    }
    for (const p of s.projects) {
      if (!Number.isInteger(p.progress) || p.progress < 0 || p.progress > 100) v(`bad progress ${p.progress}`);
      if (!["planning", "active", "review", "completed", "on-hold"].includes(p.status)) v(`bad status ${p.status}`);
      if (p.status === "completed" && p.progress !== 100) v("completed below 100%");
      if (Number.isNaN(Date.parse(p.dueDate)) || p.dueDate.slice(0, 10) < p.startDate.slice(0, 10)) v(`bad due date ${p.dueDate}`);
      const before_p = before.projects.find((x) => x.id === p.id)!;
      if (p.ownerId !== before_p.ownerId && s.users.find((u) => u.id === p.ownerId)?.role !== "admin") v("owner not a team member");
    }
    for (const u of s.users) if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i.test(u.email) || u.name.length > 80) v(`bad user ${u.email}`);
    for (const sh of s.shares) {
      const res = api.resolveShare(s, sh.token);
      const creator = s.users.find((u) => u.id === sh.createdBy);
      if ("file" in res && (!creator || !allowed(s, creator))) v("link works for a creator without access");
    }
  }
  return { ok, violations };
}

it("random API sessions never break the server's rules", () => {
  let calls = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const { ok, violations } = fuzz(current, seed);
    calls += ok;
    expect(violations, `seed ${seed}`).toEqual([]);
  }
  expect(calls).toBeGreaterThan(1000);
});

it("random files: text is read as text, binary isn't, and CSV cells round-trip", async () => {
  const { decodeText, parseCsv, sniff } = await import("@/lib/sniff");
  const rng = mulberry32(7);
  const pick = <T,>(a: readonly T[]): T => a[Math.floor(rng() * a.length)];
  const WORDS = ["Müller", "Şubat", "naïve", "東京", "50,00", 'say "hi"', "a;b", "line\nbreak", "€12", "plain", "", " spaced "];
  let misses = 0;
  for (let n = 0; n < 1500; n++) {
    const kind = pick(["binary", "utf8", "utf16", "latin1", "csv"] as const);
    if (kind === "binary") {
      const b = Uint8Array.from({ length: 200 + Math.floor(rng() * 4000) }, () => Math.floor(rng() * 256));
      if (sniff(b) === null && decodeText(b) !== null) misses++;
    } else if (kind === "csv") {
      const d = pick([",", ";", "\t"]);
      const cols = 2 + Math.floor(rng() * 5);
      const rows = Array.from({ length: 2 + Math.floor(rng() * 20) }, (_, r) => Array.from({ length: cols }, (_, c) => (r === 0 ? `Col ${c}` : pick(WORDS))));
      const q = (c: string) => (/["\n\r,;\t]/.test(c) || c === "" ? `"${c.replace(/"/g, '""')}"` : c);
      const text = rows.map((r) => r.map(q).join(d)).join(pick(["\n", "\r\n"]));
      if (JSON.stringify(parseCsv(text, undefined, 100)) !== JSON.stringify(rows)) misses++;
    } else {
      const text = Array.from({ length: 5 + Math.floor(rng() * 200) }, () => pick(kind === "latin1" ? ["Müller", "café", "plain", "50,00", "\n"] : WORDS)).join(" ");
      const bytes = kind === "utf16" ? Uint8Array.from([0xff, 0xfe, ...Buffer.from(text, "utf16le")]) : kind === "latin1" ? Uint8Array.from(Buffer.from(text, "latin1")) : Uint8Array.from(Buffer.from(text));
      if (decodeText(bytes) !== text) misses++;
    }
  }
  expect(misses).toBe(0);
});
