"use client";

import EmptyState from "@/components/common/EmptyState";
import Pagination from "@/components/tables/Pagination";
import { ArrowDownIcon, ArrowUpIcon } from "@/icons";
import { cn } from "@/utils";
import { useEffect, useMemo, useState } from "react";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number;
  className?: string;
  align?: "start" | "end" | "center";
  hideOnMobile?: boolean; // masqué dans la vue « cartes »
  primary?: boolean; // titre de la carte mobile
}

interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  pageSize?: number;
  initialSort?: { key: string; dir: "asc" | "desc" };
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  rowClassName?: (row: T) => string;
  footer?: React.ReactNode;
  dense?: boolean;
}

/** Tableau générique : tri, pagination, vue cartes sur mobile, état vide. */
export default function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  pageSize = 10,
  initialSort,
  emptyTitle = "Aucun résultat",
  emptyDescription = "Modifiez vos filtres ou créez un nouvel élément.",
  emptyAction,
  rowClassName,
  footer,
  dense,
}: DataTableProps<T>) {
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const sv = col.sortValue;
    return [...rows].sort((a, b) => {
      const va = sv(a);
      const vb = sv(b);
      const r = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "fr");
      return sort.dir === "asc" ? r : -r;
    });
  }, [rows, sort, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize);

  const toggleSort = (key: string) => setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  const alignCls = (a?: Column<T>["align"]) => (a === "end" ? "text-end" : a === "center" ? "text-center" : "text-start");

  if (!rows.length) return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;

  const primary = columns.find((c) => c.primary) ?? columns[0];

  return (
    <div>
      {/* Vue tableau (tablette / ordinateur) */}
      <div className="custom-scrollbar hidden max-w-full overflow-x-auto md:block">
        <table className="min-w-full">
          <thead>
            <tr className="border-y border-gray-100 bg-gray-50/60 dark:border-gray-800 dark:bg-white/2">
              {columns.map((c) => (
                <th key={c.key} className={cn("px-4 py-3 text-theme-xs font-medium whitespace-nowrap text-gray-500 dark:text-gray-400", alignCls(c.align), c.className)}>
                  {c.sortValue ? (
                    <button onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200">
                      {c.header}
                      {sort?.key === c.key && (sort.dir === "asc" ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />)}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {pageRows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn("transition-colors", onRowClick && "cursor-pointer hover:bg-brand-25 dark:hover:bg-white/3", rowClassName?.(row))}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-4 text-theme-sm text-gray-700 dark:text-gray-300", dense ? "py-2" : "py-3", alignCls(c.align), c.className)}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Vue cartes (téléphone) */}
      <ul className="space-y-3 md:hidden">
        {pageRows.map((row) => (
          <li
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cn("rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/3", onRowClick && "cursor-pointer active:bg-gray-50 dark:active:bg-white/5", rowClassName?.(row))}
          >
            <div className="mb-2 text-sm font-medium text-gray-800 dark:text-white/90">{primary.render(row)}</div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
              {columns
                .filter((c) => c !== primary && !c.hideOnMobile)
                .map((c) => (
                  <div key={c.key} className="min-w-0">
                    <dt className="text-theme-xs text-gray-500 dark:text-gray-400">{c.header}</dt>
                    <dd className="truncate text-sm text-gray-700 dark:text-gray-300">{c.render(row)}</dd>
                  </div>
                ))}
            </dl>
          </li>
        ))}
      </ul>

      <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-100 px-4 pt-4 sm:flex-row dark:border-gray-800">
        <p className="text-theme-xs text-gray-500 dark:text-gray-400">
          {sorted.length} élément{sorted.length > 1 ? "s" : ""} · page {page} / {totalPages}
        </p>
        {footer}
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={(p) => setPage(Math.min(Math.max(1, p), totalPages))} />
      </div>
    </div>
  );
}
