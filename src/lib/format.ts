let lang: "en" | "tr" = "en";

/** Follows the interface language. */
export function setFormatLocale(next: "en" | "tr") {
  lang = next;
}
export const uiLang = () => lang;
export const uiLocale = () => (lang === "tr" ? "tr-TR" : "en-US");

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const digits = v >= 100 ? 0 : 1;
  return `${v.toLocaleString(uiLocale(), { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${units[i]}`;
}

export const formatMoney = (n: number) =>
  new Intl.NumberFormat(uiLocale(), { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(uiLocale(), { month: "short", day: "numeric", year: "numeric" });

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(uiLocale(), { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function timeAgo(iso: string | null, now = Date.now()): string {
  const tr = lang === "tr";
  if (!iso) return tr ? "Hiç" : "Never";
  const s = Math.round((now - Date.parse(iso)) / 1000);
  if (s < 60) return tr ? "Az önce" : "Just now";
  const m = Math.round(s / 60);
  if (m < 60) return tr ? `${m} dk önce` : `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return tr ? `${h} sa önce` : `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return tr ? `${d} gün önce` : `${d} d ago`;
  return formatDate(iso);
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w))
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
