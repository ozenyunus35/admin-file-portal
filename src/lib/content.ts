import type { Company, FileItem } from "./types";

/**
 * Seeded files have no stored bytes. When one is previewed or downloaded we
 * generate a small, valid file of the right type with synthetic content.
 */

const ascii = (s: string) => s.replace(/[^\x20-\x7e]/g, "?");

/** A minimal single-page PDF with Helvetica text lines. */
export function buildPdf(title: string, lines: string[]): Uint8Array {
  const esc = (s: string) => ascii(s).replace(/[\\()]/g, (c) => `\\${c}`);
  const body = [
    "BT /F1 20 Tf 56 770 Td (" + esc(title) + ") Tj ET",
    "0.37 0.92 0.83 RG 2 w 56 755 m 539 755 l S",
    ...lines.map((line, i) => `BT /F1 11 Tf 56 ${728 - i * 18} Td (${esc(line)}) Tj ET`),
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${body.length} >>\nstream\n${body}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of data) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** A ZIP archive with uncompressed ("stored") entries. */
export function buildZip(entries: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBytes = enc.encode(name);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, nameBytes.length, true);
    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true);
    dir.setUint16(4, 20, true);
    dir.setUint16(6, 20, true);
    dir.setUint32(16, crc, true);
    dir.setUint32(20, data.length, true);
    dir.setUint32(24, data.length, true);
    dir.setUint16(28, nameBytes.length, true);
    dir.setUint32(42, offset, true);
    chunks.push(new Uint8Array(local.buffer), nameBytes, data);
    central.push(new Uint8Array(dir.buffer), nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const dirSize = central.reduce((s, c) => s + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, dirSize, true);
  end.setUint32(16, offset, true);
  const all = [...chunks, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((s, c) => s + c.length, 0));
  let p = 0;
  for (const c of all) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}

const xmlEsc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);

function hash(s: string) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** A website mockup-style illustration, tinted per file so thumbnails differ. */
export function buildSvg(file: FileItem, company: Company): string {
  const hue = hash(file.name + company.id) % 360;
  const accent = `hsl(${hue} 70% 55%)`;
  const soft = `hsl(${hue} 60% 92%)`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
<rect width="1200" height="800" fill="#f8fafc"/>
<rect width="1200" height="64" fill="#0f172a"/>
<circle cx="40" cy="32" r="12" fill="${accent}"/>
<text x="64" y="40" font-family="Arial, sans-serif" font-size="20" fill="#fff">${xmlEsc(company.name)}</text>
<rect x="80" y="130" width="560" height="300" rx="16" fill="${soft}"/>
<text x="110" y="220" font-family="Arial, sans-serif" font-size="44" font-weight="700" fill="#0f172a">${xmlEsc(file.name.replace(/\.[^.]+$/, ""))}</text>
<rect x="110" y="260" width="380" height="18" rx="9" fill="#cbd5e1"/>
<rect x="110" y="292" width="300" height="18" rx="9" fill="#cbd5e1"/>
<rect x="110" y="350" width="170" height="52" rx="26" fill="${accent}"/>
<rect x="700" y="130" width="420" height="300" rx="16" fill="${accent}" opacity="0.85"/>
<circle cx="910" cy="280" r="90" fill="#fff" opacity="0.35"/>
${[0, 1, 2].map((i) => `<rect x="${80 + i * 353}" y="480" width="333" height="220" rx="16" fill="#fff" stroke="#e2e8f0"/><rect x="${110 + i * 353}" y="510" width="60" height="60" rx="12" fill="${soft}"/><rect x="${110 + i * 353}" y="600" width="240" height="14" rx="7" fill="#cbd5e1"/><rect x="${110 + i * 353}" y="626" width="180" height="14" rx="7" fill="#e2e8f0"/>`).join("")}
<text x="1120" y="780" text-anchor="end" font-family="Arial, sans-serif" font-size="14" fill="#94a3b8">Synthetic demo asset</text>
</svg>`;
}

function buildCsv(file: FileItem, company: Company): string {
  const seed = hash(file.id);
  const rows = ["date,channel,sessions,conversions,revenue_usd"];
  const channels = ["Organic", "Paid search", "Email", "Social", "Referral"];
  const start = Date.parse(file.createdAt) - 29 * 86_400_000;
  for (let d = 0; d < 30; d++) {
    for (const [i, ch] of channels.entries()) {
      const s = 80 + ((seed >>> (i + (d % 7))) % 400);
      const conv = Math.round(s * (0.02 + ((seed >>> i) % 5) / 100));
      rows.push(`${new Date(start + d * 86_400_000).toISOString().slice(0, 10)},${ch},${s},${conv},${(conv * (40 + (i * 13) % 60)).toFixed(2)}`);
    }
  }
  return `# ${company.name} - synthetic demo data\n` + rows.join("\n") + "\n";
}

function buildMarkdown(file: FileItem, company: Company): string {
  return `# ${file.name.replace(/\.md$/, "")}

**Client:** ${company.name}
**Date:** ${file.createdAt.slice(0, 10)}

> Synthetic demo document. Names and details are invented.

## Summary
- Agreed on scope, milestones and a weekly check-in.
- Shared folder structure set up for contracts, design and reports.
- Next review scheduled in two weeks.

## Action items
1. Upload brand assets to the Design folder.
2. Confirm billing contact for invoices.
3. Review the draft project timeline.
`;
}

export function seedBlob(file: FileItem, company: Company): Blob {
  switch (file.seed) {
    case "pdf":
      return new Blob([buildPdf(file.name.replace(/\.pdf$/i, ""), [
        `Client: ${company.name}`,
        `Prepared: ${file.createdAt.slice(0, 10)}`,
        "",
        "This is a synthetic document generated for the Atlas Portal demo.",
        "All companies, names and figures in this demo are invented.",
        "",
        "1. Scope of work and deliverables",
        "2. Timeline and milestones",
        "3. Fees, invoicing and payment terms",
        "4. Confidentiality and data handling",
      ]) as BlobPart], { type: file.mime });
    case "image":
      return new Blob([buildSvg(file, company)], { type: "image/svg+xml" });
    case "csv":
      return new Blob([buildCsv(file, company)], { type: "text/csv" });
    case "text":
      return new Blob([buildMarkdown(file, company)], { type: "text/markdown" });
    case "archive": {
      const enc = new TextEncoder();
      return new Blob([buildZip([
        { name: "README.txt", data: enc.encode(`Synthetic demo archive for ${company.name}.\nThe listed size is simulated; the real archive is tiny.\n`) },
        { name: "logo.svg", data: enc.encode(buildSvg({ ...file, name: "Logo" }, company)) },
      ]) as BlobPart], { type: "application/zip" });
    }
    default:
      return new Blob([], { type: file.mime });
  }
}

export type PreviewKind = "image" | "pdf" | "text" | "none";

export function previewKind(mime: string, name: string): PreviewKind {
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf" || /\.pdf$/i.test(name)) return "pdf";
  if (mime.startsWith("text/") || /\.(md|csv|txt|json)$/i.test(name)) return "text";
  return "none";
}
