import { describe, expect, it } from "vitest";
import { buildPdf, buildZip, crc32, previewKind } from "@/lib/content";
import { toCsv } from "@/lib/csv";
import { formatBytes, initials, timeAgo } from "@/lib/format";
import { queryTable } from "@/lib/query";
import { createSeed } from "@/lib/seed";
import { kpis, projectsByStatus, uploadsByDay } from "@/lib/stats";

const rows = [
  { id: 1, name: "Charlie", role: "admin", seen: 3 as number | null },
  { id: 2, name: "alice", role: "client", seen: null },
  { id: 3, name: "Bob", role: "client", seen: 10 },
  { id: 4, name: "Alicia", role: "client", seen: 1 },
];

describe("queryTable", () => {
  it("searches case-insensitively across keys", () => {
    expect(queryTable(rows, { search: "ALI", searchKeys: ["name"] }).rows.map((r) => r.id)).toEqual([2, 4]);
  });
  it("filters by exact value", () => {
    expect(queryTable(rows, { filters: { role: "admin" } }).total).toBe(1);
  });
  it("sorts strings naturally and keeps nulls last in both directions", () => {
    expect(queryTable(rows, { sortKey: "name" }).rows.map((r) => r.name)).toEqual(["alice", "Alicia", "Bob", "Charlie"]);
    expect(queryTable(rows, { sortKey: "seen", sortDir: "asc" }).rows.map((r) => r.id)).toEqual([4, 1, 3, 2]);
    expect(queryTable(rows, { sortKey: "seen", sortDir: "desc" }).rows.map((r) => r.id)).toEqual([3, 1, 4, 2]);
  });
  it("paginates and clamps the page", () => {
    const r = queryTable(rows, { pageSize: 3, page: 9 });
    expect(r).toMatchObject({ page: 2, pageCount: 2, total: 4 });
    expect(r.rows).toHaveLength(1);
    expect(queryTable([], { pageSize: 10 })).toMatchObject({ page: 1, pageCount: 1, total: 0 });
  });
});

describe("toCsv", () => {
  it("quotes special characters and neutralises formulas", () => {
    const csv = toCsv([{ a: 'He said "hi", ok', b: "=SUM(A1)", c: 5 }], [
      { header: "A", value: (r) => r.a },
      { header: "B", value: (r) => r.b },
      { header: "C", value: (r) => r.c },
    ]);
    expect(csv).toBe('A,B,C\r\n"He said ""hi"", ok",\'=SUM(A1),5\r\n');
  });
  it("does not touch negative numbers", () => {
    expect(toCsv([{ n: -5 }], [{ header: "N", value: (r) => r.n }])).toBe("N\r\n-5\r\n");
  });
});

describe("format", () => {
  it("formats bytes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(2 * 1024 ** 3)).toBe("2.0 GB");
    expect(formatBytes(250 * 1024 ** 2)).toBe("250 MB");
  });
  it("formats relative time", () => {
    const now = Date.parse("2026-10-28T12:00:00Z");
    expect(timeAgo(null)).toBe("Never");
    expect(timeAgo("2026-10-28T11:30:00Z", now)).toBe("30 min ago");
    expect(timeAgo("2026-10-26T12:00:00Z", now)).toBe("2 d ago");
  });
  it("builds initials", () => {
    expect(initials("Maya  Chen")).toBe("MC");
    expect(initials("Cher")).toBe("C");
  });
});

describe("generated file content", () => {
  it("builds a PDF with a valid xref table", () => {
    const text = new TextDecoder().decode(buildPdf("Report (Q4)", ["Line one", "Ünïcode"]));
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("(Report \\(Q4\\)) Tj");
    const xrefAt = Number(text.match(/startxref\n(\d+)/)![1]);
    expect(text.slice(xrefAt, xrefAt + 4)).toBe("xref");
    const offsets = [...text.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    offsets.forEach((o, i) => expect(text.slice(o).startsWith(`${i + 1} 0 obj`)).toBe(true));
  });
  it("computes CRC-32 and builds a readable ZIP", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    const zip = buildZip([{ name: "a.txt", data: new TextEncoder().encode("hello") }]);
    const view = new DataView(zip.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint32(zip.length - 22, true)).toBe(0x06054b50);
    expect(view.getUint16(zip.length - 22 + 10, true)).toBe(1);
  });
  it("picks a preview type", () => {
    expect(previewKind("image/png", "a.png")).toBe("image");
    expect(previewKind("", "scan.PDF")).toBe("pdf");
    expect(previewKind("text/csv", "a.csv")).toBe("text");
    expect(previewKind("application/zip", "a.zip")).toBe("none");
  });
});

describe("stats", () => {
  const now = new Date("2026-10-28T12:00:00Z");
  const s = createSeed(now);
  it("counts uploads per day for every seeded file", () => {
    const days = uploadsByDay(s, 30, now);
    expect(days).toHaveLength(30);
    expect(days.reduce((n, d) => n + d.uploads, 0)).toBe(s.files.length);
  });
  it("computes KPIs and status totals", () => {
    const k = kpis(s, now.getTime());
    expect(k.filesLast30).toBe(s.files.length);
    expect(k.openProjects).toBe(s.projects.filter((p) => p.status !== "completed").length);
    expect(projectsByStatus(s).reduce((n, x) => n + x.count, 0)).toBe(s.projects.length);
  });
});
