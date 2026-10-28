export function randomId(prefix: string, bytes = 6): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return `${prefix}-${Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/** URL-safe token for share links. */
export function shareToken(): string {
  const buf = new Uint8Array(12);
  crypto.getRandomValues(buf);
  return btoa(String.fromCharCode(...buf)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
