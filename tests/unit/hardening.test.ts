import { describe, expect, it } from "vitest";
import * as api from "@/lib/api";
import { ApiError } from "@/lib/api";
import { DEMO_ADMIN_ID, DEMO_CLIENT_ID, PLAN_QUOTA, createSeed } from "@/lib/seed";
import { csvDelimiter, decodeText, parseCsv, sniff } from "@/lib/sniff";
import type { DemoState } from "@/lib/types";

const fresh = () => createSeed(new Date("2026-10-28T12:00:00Z"));
const by = (s: DemoState, id: string) => s.users.find((u) => u.id === id)!;

function status(fn: () => unknown): number | "ok" {
  try {
    fn();
    return "ok";
  } catch (e) {
    expect(e).toBeInstanceOf(ApiError);
    return (e as ApiError).status;
  }
}

describe("acting user must still have access", () => {
  const s = fresh();
  const client = by(s, DEMO_CLIENT_ID);
  const folder = s.folders.find((f) => f.companyId === client.companyId)!;
  const file = s.files.find((f) => f.companyId === client.companyId)!;
  const disabled = { ...s, users: s.users.map((u) => (u.id === client.id ? { ...u, status: "disabled" as const } : u)) };
  const paused = { ...s, companies: s.companies.map((c) => (c.id === client.companyId ? { ...c, status: "paused" as const } : c)) };

  it("blocks a disabled user whose session is still open", () => {
    expect(status(() => api.checkUpload(disabled, client, folder.id, 10))).toBe(403);
    expect(status(() => api.createShare(disabled, client, file.id, 7))).toBe(403);
    expect(status(() => api.recordDownload(disabled, client, file.id))).toBe(403);
  });

  it("blocks clients of a paused company, and they can't sign in", () => {
    expect(status(() => api.checkUpload(paused, client, folder.id, 10))).toBe(403);
    expect(api.canSignIn(paused, client)).toBe(false);
    expect(api.canSignIn(paused, by(paused, DEMO_ADMIN_ID))).toBe(true);
  });

  it("an admin demoted in another tab loses admin rights at once", () => {
    const other = s.users.find((u) => u.role === "admin" && u.id !== DEMO_ADMIN_ID)!;
    const demoted = { ...s, users: s.users.map((u) => (u.id === other.id ? { ...u, role: "client" as const, companyId: client.companyId } : u)) };
    expect(status(() => api.updateCompany(demoted, other, s.companies[0].id, { status: "active" }))).toBe(403);
  });
});

describe("share links", () => {
  it("stop when the creator is disabled or the company paused, and expire at the exact time", () => {
    const s = fresh();
    const client = by(s, DEMO_CLIENT_ID);
    const file = s.files.find((f) => f.companyId === client.companyId)!;
    const { state, share } = api.createShare(s, client, file.id, 1);
    expect("file" in api.resolveShare(state, share.token)).toBe(true);
    expect(api.resolveShare(state, share.token, Date.parse(share.expiresAt))).toEqual({ error: "This link has expired." });
    const off = { ...state, users: state.users.map((u) => (u.id === client.id ? { ...u, status: "disabled" as const } : u)) };
    expect("error" in api.resolveShare(off, share.token)).toBe(true);
    const paused = { ...state, companies: state.companies.map((c) => (c.id === file.companyId ? { ...c, status: "paused" as const } : c)) };
    expect("error" in api.resolveShare(paused, share.token)).toBe(true);
  });

  it("clients revoke only their own links; revokes and link downloads are logged", () => {
    const s = fresh();
    const admin = by(s, DEMO_ADMIN_ID), client = by(s, DEMO_CLIENT_ID);
    const file = s.files.find((f) => f.companyId === client.companyId)!;
    const a = api.createShare(s, admin, file.id, 7);
    expect(status(() => api.revokeShare(a.state, client, a.share.id))).toBe(403);
    const c = api.createShare(a.state, client, file.id, 7);
    const revoked = api.revokeShare(c.state, client, c.share.id);
    expect(revoked.activity[0]).toMatchObject({ action: "share.revoke", actorId: client.id, target: file.name });
    const used = api.recordShareDownload(revoked, a.share.token);
    expect(used.shares.find((x) => x.id === a.share.id)!.downloads).toBe(1);
    expect(used.activity[0]).toMatchObject({ action: "share.download", actorId: admin.id });
    expect(status(() => api.recordShareDownload(revoked, c.share.token))).toBe(404);
  });
});

describe("uploads", () => {
  const s = fresh();
  const client = by(s, DEMO_CLIENT_ID);
  const folder = s.folders.find((f) => f.companyId === client.companyId)!;
  const add = (name: string, size = 10, id = "file-new") => api.addFile(s, client, { id, folderId: folder.id, name, mime: "", size });

  it("rejects empty, negative, fractional and NaN sizes", () => {
    for (const size of [0, -5, 1.5, NaN, Infinity]) expect(status(() => api.checkUpload(s, client, folder.id, size))).toBe(400);
    expect(status(() => api.checkUpload(s, client, folder.id, api.MAX_UPLOAD_BYTES + 1))).toBe(413);
    expect(status(() => api.checkUpload(s, client, folder.id, api.MAX_UPLOAD_BYTES))).toBe("ok");
  });

  it("cleans names: no path, control or bidi characters, long names keep their extension", () => {
    expect(add("../../etc/a\u0000b.pdf").files[0].name).toBe("ab.pdf");
    expect(add("C:\\Users\\me\\Desktop\\Fatura Şubat.pdf").files[0].name).toBe("Fatura Şubat.pdf");
    expect(add("invoice\u202Efdp.exe").files[0].name).toBe("invoicefdp.exe");
    const long = add("x".repeat(500) + ".tar.gz").files[0].name;
    expect(long).toHaveLength(api.MAX_FILE_NAME);
    expect(long.endsWith(".tar.gz")).toBe(true);
    for (const bad of ["", "   ", "..", "a/"]) expect(status(() => add(bad))).toBe(400);
    expect(status(() => add("ok.pdf", 10, s.files[0].id))).toBe(409);
  });

  it("numbers duplicates without stacking suffixes and keeps double extensions", () => {
    const n = (names: string[], name: string) => api.uniqueName(names.reduce((st, x, i) => api.addFile(st, client, { id: `n${i}`, folderId: folder.id, name: x, mime: "", size: 1 }), s), folder.id, name);
    expect(n(["Report.pdf", "Report (1).pdf"], "Report (1).pdf")).toBe("Report (2).pdf");
    expect(n(["a.tar.gz"], "a.tar.gz")).toBe("a (1).tar.gz");
    expect(n([".env"], ".env")).toBe(".env (1)");
    expect(n(["README"], "readme")).toBe("readme (1)");
    expect(n(["v1.2 notes.txt"], "v1.2 notes.txt")).toBe("v1.2 notes (1).txt");
  });
});

describe("clients and projects", () => {
  const s = fresh();
  const admin = by(s, DEMO_ADMIN_ID);

  it("won't shrink a quota below what the client already stores", () => {
    const big = s.companies.reduce((a, c) => (api.storageUsed(s, c.id) > api.storageUsed(s, a.id) ? c : a));
    expect(api.storageUsed(s, big.id)).toBeGreaterThan(0);
    expect(status(() => api.updateCompany(s, admin, big.id, { quota: api.storageUsed(s, big.id) - 1 }))).toBe(409);
    for (const quota of [-1, 0, NaN, 1.5]) expect(status(() => api.updateCompany(s, admin, big.id, { quota }))).toBe(400);
    expect(status(() => api.updateCompany(s, admin, big.id, { plan: "Gold" as never }))).toBe(400);
    expect(status(() => api.updateCompany(s, admin, big.id, { plan: "Enterprise", quota: PLAN_QUOTA.Enterprise }))).toBe("ok");
  });

  it("validates project edits", () => {
    const p = s.projects.find((x) => x.status !== "completed")!;
    const client = by(s, DEMO_CLIENT_ID);
    for (const progress of [NaN, 33.3, -1, 101]) expect(status(() => api.updateProject(s, admin, p.id, { progress }))).toBe(400);
    expect(status(() => api.updateProject(s, admin, p.id, { status: "zzz" as never }))).toBe(400);
    expect(status(() => api.updateProject(s, admin, p.id, { ownerId: "nope" }))).toBe(404);
    expect(status(() => api.updateProject(s, admin, p.id, { ownerId: client.id }))).toBe(400);
    expect(status(() => api.updateProject(s, admin, p.id, { dueDate: "2000-01-01" }))).toBe(400);
    expect(status(() => api.updateProject(s, admin, p.id, { dueDate: "not a date" }))).toBe(400);
    expect(status(() => api.updateProject(s, admin, p.id, { status: "completed", progress: 40 }))).toBe(400);
    expect(status(() => api.updateProject(s, admin, p.id, { status: "completed", progress: 100 }))).toBe("ok");
  });

  it("every seeded project can be saved unchanged, even with a disabled owner", () => {
    for (const p of s.projects) expect(status(() => api.updateProject(s, admin, p.id, { status: p.status, progress: p.progress, ownerId: p.ownerId }))).toBe("ok");
  });

  it("validates users: trims email, real TLDs, length caps", () => {
    const base = { name: "Ann Lee", role: "client" as const, title: "", companyId: s.companies[1].id };
    expect(api.createUser(s, admin, { ...base, email: "  Ann@Example.org " }).users[0].email).toBe("ann@example.org");
    for (const email of ["a@b.c", "a@b", "a@@b.co", "a b@c.co", "a@.co", "a@b..co"]) expect(status(() => api.createUser(s, admin, { ...base, email }))).toBe(400);
    expect(status(() => api.createUser(s, admin, { ...base, email: "q@x.example", name: "x".repeat(81) }))).toBe(400);
    expect(status(() => api.createUser(s, admin, { ...base, email: "q@x.example", role: "owner" as never }))).toBe(400);
  });
});

describe("file content", () => {
  const b = (...parts: Array<string | number[]>) => new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? Array.from(Buffer.from(p)) : p)));

  it("recognises formats from their first bytes", () => {
    expect(sniff(b("%PDF-1.7\n"))).toBe("pdf");
    expect(sniff(b([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]))).toBe("png");
    expect(sniff(b([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
    expect(sniff(b([0, 0, 0, 24], "ftypheic"))).toBe("heic");
    expect(sniff(b("II*\0"))).toBe("tiff");
    expect(sniff(b("PK\x03\x04"))).toBe("zip");
    expect(sniff(b('\ufeff<?xml version="1.0"?>\n<!-- x -->\n<svg xmlns="http://www.w3.org/2000/svg">'))).toBe("svg");
    expect(sniff(b("  <!DOCTYPE html><html>"))).toBe("html");
    expect(sniff(b("Date,Amount\n"))).toBeNull();
  });

  it("decodes UTF-8, UTF-16 and Windows-1252 text, and refuses binary", () => {
    expect(decodeText(b([0xff, 0xfe], Array.from(Buffer.from("Merhaba dünya", "utf16le"))))).toBe("Merhaba dünya");
    expect(decodeText(b([0xef, 0xbb, 0xbf], "Grüße"))).toBe("Grüße");
    expect(decodeText(b([0x4d, 0xfc, 0x6c, 0x6c, 0x65, 0x72]))).toBe("Müller");
    expect(decodeText(b("ok ", [0xc3]))).toBe("ok ");
    expect(decodeText(b(Array.from({ length: 4000 }, (_, i) => (i * 7919 + 13) % 256)))).toBeNull();
  });

  it("reads ; separated and multi-line CSV", () => {
    const de = "Datum;Kunde;Betrag\n01.10.2026;Müller GmbH;\"1.234,50\"\n02.10.2026;\"Schmidt; Söhne\";99,00\n";
    expect(csvDelimiter(de)).toBe(";");
    expect(parseCsv(de)).toEqual([["Datum", "Kunde", "Betrag"], ["01.10.2026", "Müller GmbH", "1.234,50"], ["02.10.2026", "Schmidt; Söhne", "99,00"]]);
    expect(parseCsv('name,note\r\nA,"line one\r\nline two"\r\nB,ok\r\n')).toEqual([["name", "note"], ["A", "line one\r\nline two"], ["B", "ok"]]);
    expect(parseCsv("# comment\na,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(csvDelimiter("a\tb\tc\n1\t2\t3")).toBe("\t");
    expect(parseCsv("only one column\nsecond")).toEqual([["only one column"], ["second"]]);
  });
});
