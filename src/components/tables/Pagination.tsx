import { ChevronLeftIcon } from "@/icons";
import { cn } from "@/utils";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;
  const start = Math.max(1, Math.min(currentPage - 1, totalPages - 2));
  const pages = Array.from({ length: Math.min(3, totalPages) }, (_, i) => start + i);
  const nav = "flex size-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 shadow-theme-xs hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/3";

  return (
    <div className="flex items-center gap-1.5">
      <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className={nav} aria-label="Page précédente">
        <ChevronLeftIcon className="size-4 rtl:rotate-180" />
      </button>
      {start > 1 && <span className="px-1 text-gray-400">…</span>}
      {pages.map((page) => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          className={cn(
            "flex size-9 items-center justify-center rounded-lg text-sm font-medium",
            currentPage === page ? "bg-brand-500 text-white" : "text-gray-700 hover:bg-brand-50 hover:text-brand-600 dark:text-gray-400 dark:hover:bg-white/5",
          )}
        >
          {page}
        </button>
      ))}
      {start + 2 < totalPages && <span className="px-1 text-gray-400">…</span>}
      <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className={nav} aria-label="Page suivante">
        <ChevronLeftIcon className="size-4 rotate-180 rtl:rotate-0" />
      </button>
    </div>
  );
};

export default Pagination;
