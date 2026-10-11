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
    <div className={cn("no-scrollbar -mx-1 overflow-x-auto px-1", className)}>
      <div role="tablist" className="inline-flex min-w-full gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 sm:min-w-0 dark:border-gray-800 dark:bg-gray-900">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={active === t.key}
            onClick={() => onChange(t.key)}
            className={cn(
              "flex min-h-9 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition",
              active === t.key ? "bg-white text-brand-700 shadow-theme-xs dark:bg-gray-800 dark:text-brand-300" : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90",
            )}
          >
            {t.label}
            {t.count !== undefined && <span className={cn("rounded-full px-1.5 text-theme-xs", active === t.key ? "bg-brand-50 dark:bg-brand-500/15" : "bg-gray-200/70 dark:bg-white/10")}>{t.count}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
