/**
 * What a file really is, from its first bytes rather than its name, and reading
 * text files the way people actually save them (BOMs, UTF-16, ";" separated CSV).
 */

export type Sniffed = "pdf" | "png" | "jpeg" | "gif" | "webp" | "bmp" | "heic" | "tiff" | "zip" | "svg" | "html";

const starts = (b: Uint8Array, sig: number[], at = 0) => sig.every((x, i) => b[at + i] === x);
const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));

export function sniff(b: Uint8Array): Sniffed | null {
  if (starts(b, ascii("%PDF-"))) return "pdf";
  if (starts(b, [0x89, 0x50, 0x4e, 0x47])) return "png";
  if (starts(b, [0xff, 0xd8, 0xff])) return "jpeg";
  if (starts(b, ascii("GIF8"))) return "gif";
  if (starts(b, ascii("RIFF")) && starts(b, ascii("WEBP"), 8)) return "webp";
  if (starts(b, ascii("BM")) && b.length > 26 && b[14] >= 12 && b[15] === 0) return "bmp";
  if (starts(b, ascii("ftyp"), 4) && /^(heic|heix|hevc|mif1|msf1|avif)$/.test(String.fromCharCode(...b.slice(8, 12)))) return "heic";
  if (starts(b, [0x49, 0x49, 0x2a, 0]) || starts(b, [0x4d, 0x4d, 0, 0x2a])) return "tiff";
  if (starts(b, ascii("PK\x03\x04")) || starts(b, ascii("PK\x05\x06"))) return "zip";
  const head = new TextDecoder("utf-8", { fatal: false }).decode(b.slice(0, 512)).replace(/^\ufeff/, "").trimStart().toLowerCase();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!doctype svg|<svg[\s>])/.test(head)) return "svg";
  if (/^(<!doctype html|<html|<head|<body|<script)/.test(head)) return "html";
  return null;
}

/** Image types a browser shows in an <img> and that can't run script when opened on their own. */
export const RASTER: Partial<Record<Sniffed, string>> = { png: "image/png", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", bmp: "image/bmp" };

export const LABEL: Record<Sniffed, string> = {
  pdf: "PDF", png: "PNG image", jpeg: "JPEG image", gif: "GIF image", webp: "WebP image", bmp: "BMP image",
  heic: "HEIC photo", tiff: "TIFF image", zip: "ZIP archive (or an Office document)", svg: "SVG image", html: "web page",
};

/**
 * Text from the bytes of a text file, or null when the bytes are not text
 * (a binary file renamed .txt). Handles UTF-8, UTF-16 with a BOM, and falls
 * back to Windows-1252 for old exports that are not valid UTF-8.
 */
export function decodeText(b: Uint8Array): string | null {
  let text: string;
  if (starts(b, [0xff, 0xfe])) text = new TextDecoder("utf-16le").decode(b.subarray(2));
  else if (starts(b, [0xfe, 0xff])) text = new TextDecoder("utf-16be").decode(b.subarray(2));
  else {
    if (b.includes(0)) return null;
    try {
      // Streaming leaves a multi-byte character cut off at the end of the preview slice pending instead of failing.
      text = new TextDecoder("utf-8", { fatal: true }).decode(b, { stream: true });
    } catch {
      text = new TextDecoder("windows-1252").decode(b);
    }
  }
  text = text.replace(/^\ufeff/, "");
  const control = text.match(/[\x00-\x08\x0e-\x1f\x7f\ufffd]/g)?.length ?? 0;
  return control > Math.max(2, text.length * 0.02) ? null : text;
}

/** The separator a CSV uses: the one that splits the first lines into the same, largest number of cells. */
export function csvDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l && !l.startsWith("#")).slice(0, 10);
  let best = ",", bestScore = 0;
  for (const d of [",", ";", "\t", "|"]) {
    const counts = lines.map((l) => parseCsv(l, d, 1)[0]?.length ?? 1);
    const first = counts[0] ?? 1;
    const consistent = counts.filter((c) => c === first).length;
    const score = first > 1 ? first * consistent : 0;
    if (score > bestScore) {
      best = d;
      bestScore = score;
    }
  }
  return best;
}

/** RFC 4180 rows, with quoted cells that hold the separator, quotes or line breaks. Lines starting "#" are comments. */
export function parseCsv(text: string, delimiter = csvDelimiter(text), maxRows = 50): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let quoted = false;
  let lineStart = true;
  const s = text.replace(/^\ufeff/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (lineStart && ch === "#" && !quoted) {
      while (i < s.length && s[i] !== "\n") i++;
      continue;
    }
    lineStart = false;
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') {
        cur += '"';
        i++;
      }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"' && cur === "") quoted = true;
    else if (ch === delimiter) {
      row.push(cur);
      cur = "";
    }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cur);
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
      cur = "";
      lineStart = true;
      if (rows.length >= maxRows) return rows;
    } else cur += ch;
  }
  row.push(cur);
  if (row.length > 1 || row[0] !== "") rows.push(row);
  return rows.slice(0, maxRows);
}
