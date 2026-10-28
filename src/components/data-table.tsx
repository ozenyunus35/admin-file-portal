"use client";

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { queryTable, type SortDir } from "@/lib/query";
import { cx, inputClass } from "./ui";

export interface Column<T> {
  key: keyof T & string;
  header: string;
  sortable?: boolean;
  /** Sort by a derived value instead of the raw field. */
  sortValue?: (row: T) => string | number | null;
  render?: (row: T) => React.ReactNode;
  className?: string;
  /** Hide on narrow screens: true hides below md, "xl" below xl. */
  hideOnMobile?: boolean | "xl";
}

export interface FilterDef<T> {
  key: keyof T & string;
  label: string;
  options: Array<{ value: string; label: string }>;
}

interface Props<T> {
  label: string;
  rows: readonly T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  searchKeys?: Array<keyof T>;
  searchPlaceholder?: string;
  filters?: FilterDef<T>[];
  initialSort?: { key: keyof T & string; dir: SortDir };
  pageSize?: number;
  toolbar?: (visible: T[]) => React.ReactNode;
  empty: React.ReactNode;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({ label, rows, columns, rowKey, searchKeys, searchPlaceholder = "Search", filters = [], initialSort, pageSize = 10, toolbar, empty, onRowClick }: Props<T>) {
  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(1);

  const sortCol = columns.find((c) => c.key === sort?.key);
  const prepared = useMemo(() => {
    if (!sortCol?.sortValue) return rows;
    return rows.map((r) => ({ ...r, __sort: sortCol.sortValue!(r) }));
  }, [rows, sortCol]);

  const filtered = useMemo(
    () =>
      queryTable(prepared as T[], {
        search,
        searchKeys,
        filters: filterValues as Partial<Record<keyof T, string>>,
        sortKey: (sortCol?.sortValue ? "__sort" : sort?.key) as keyof T | undefined,
        sortDir: sort?.dir,
      }).rows,
    [prepared, search, searchKeys, filterValues, sort, sortCol],
  );
  const result = queryTable(filtered, { page, pageSize });

  const toggleSort = (key: keyof T & string) => {
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
    setPage(1);
  };

  const from = result.total === 0 ? 0 : (result.page - 1) * pageSize + 1;
  const to = Math.min(result.page * pageSize, result.total);

  return (
    <div>
      <div className="flex flex-col gap-2 border-b border-border p-3 md:flex-row md:items-center">
        {searchKeys && (
          <div className="relative md:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className={cx(inputClass, "pl-9")}
            />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <select
              key={f.key}
              aria-label={f.label}
              value={filterValues[f.key] ?? ""}
              onChange={(e) => {
                setFilterValues((v) => ({ ...v, [f.key]: e.target.value }));
                setPage(1);
              }}
              className="h-10 rounded-lg border border-border bg-surface px-3 pr-8 text-sm focus:border-accent focus:outline-none"
            >
              <option value="">{f.label}: all</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ))}
        </div>
        {toolbar && <div className="flex gap-2 md:ml-auto">{toolbar(filtered)}</div>}
      </div>

      {result.total === 0 ? (
        empty
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              {label}, {result.total} rows{sort ? `, sorted by ${columns.find((c) => c.key === sort.key)?.header} ${sort.dir === "asc" ? "ascending" : "descending"}` : ""}
            </caption>
            <thead className="bg-surface-2 text-xs text-muted uppercase">
              <tr>
                {columns.map((c) => {
                  const active = sort?.key === c.key;
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                      className={cx("px-3 py-2.5 font-medium whitespace-nowrap sm:px-4", c.hideOnMobile && (c.hideOnMobile === "xl" ? "hidden xl:table-cell" : "hidden md:table-cell"), c.className)}
                    >
                      {c.sortable ? (
                        <button onClick={() => toggleSort(c.key)} className="-mx-1 inline-flex items-center gap-1 rounded px-1 uppercase hover:text-text">
                          {c.header}
                          {active ? sort.dir === "asc" ? <ArrowUp className="size-3.5" aria-hidden /> : <ArrowDown className="size-3.5" aria-hidden /> : <ChevronsUpDown className="size-3.5 opacity-50" aria-hidden />}
                        </button>
                      ) : (
                        c.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {result.rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  className={cx("hover:bg-surface-2/60", onRowClick && "cursor-pointer")}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (e) => e.key === "Enter" && e.target === e.currentTarget && onRowClick(row) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cx("px-3 py-3 align-middle sm:px-4", c.hideOnMobile && (c.hideOnMobile === "xl" ? "hidden xl:table-cell" : "hidden md:table-cell"), c.className)}>
                      {c.render ? c.render(row) : String(row[c.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3 text-sm text-muted">
        <p aria-live="polite">
          {from}–{to} of {result.total}
        </p>
        <div className="flex items-center gap-1">
          <button onClick={() => setPage(result.page - 1)} disabled={result.page <= 1} className="rounded-md p-1.5 hover:bg-surface-2 disabled:opacity-40" aria-label="Previous page">
            <ChevronLeft className="size-4" />
          </button>
          <span className="px-2 tabular-nums">
            Page {result.page} of {result.pageCount}
          </span>
          <button onClick={() => setPage(result.page + 1)} disabled={result.page >= result.pageCount} className="rounded-md p-1.5 hover:bg-surface-2 disabled:opacity-40" aria-label="Next page">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
