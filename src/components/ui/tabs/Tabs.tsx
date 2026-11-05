"use client";

import { cn } from "@/utils";

export interface TabItem {
  key: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}

export default function Tabs({ tabs, active, onChange, className }: TabsProps) {
  return (
    <div className={cn("no-scrollbar -mx-1 overflow-x-auto px-1 print:hidden", className)}>
      <div role="tablist" className="inline-flex min-w-full gap-1 rounded-full border border-gray-200/70 bg-white p-1 shadow-cliva sm:min-w-0 dark:border-gray-800 dark:bg-gray-900">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={active === t.key}
            onClick={() => onChange(t.key)}
            className={cn(
              "cliva-press flex min-h-9 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-all duration-200",
              active === t.key ? "bg-linear-to-br from-brand-500 to-brand-600 text-white shadow-theme-xs" : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90",
            )}
          >
            {t.label}
            {t.count !== undefined && <span className={cn("rounded-full px-1.5 text-theme-xs", active === t.key ? "bg-white/25" : "bg-gray-200/70 dark:bg-white/10")}>{t.count}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
