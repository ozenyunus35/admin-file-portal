export type SortDir = "asc" | "desc";

export interface TableQuery<T> {
  search?: string;
  /** Fields matched against `search`, case-insensitive. */
  searchKeys?: Array<keyof T>;
  filters?: Partial<Record<keyof T, string | undefined>>;
  sortKey?: keyof T;
  sortDir?: SortDir;
  page?: number;
  pageSize?: number;
}

export interface TableResult<T> {
  rows: T[];
  total: number;
  page: number;
  pageCount: number;
}

function compare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

/** Search, filter, sort and paginate in one pass. Nulls always sort last. */
export function queryTable<T>(items: readonly T[], q: TableQuery<T>): TableResult<T> {
  const needle = q.search?.trim().toLowerCase() ?? "";
  let rows = items.filter((item) => {
    for (const [key, value] of Object.entries(q.filters ?? {}) as Array<[keyof T, string | undefined]>) {
      if (value && String(item[key]) !== value) return false;
    }
    if (!needle || !q.searchKeys?.length) return true;
    return q.searchKeys.some((k) => String(item[k] ?? "").toLowerCase().includes(needle));
  });

  if (q.sortKey) {
    const key = q.sortKey;
    const dir = q.sortDir === "desc" ? -1 : 1;
    rows = [...rows].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (av == null || bv == null) return compare(av, bv);
      return compare(av, bv) * dir;
    });
  }

  const pageSize = q.pageSize ?? (rows.length || 1);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(Math.max(1, q.page ?? 1), pageCount);
  return { rows: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageCount };
}
