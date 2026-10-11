import { cn } from "@/utils";

export interface InfoItem {
  label: string;
  value: React.ReactNode;
  wide?: boolean;
}

export default function InfoGrid({ items, cols = 2 }: { items: InfoItem[]; cols?: 2 | 3 | 4 }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2", cols === 3 && "lg:grid-cols-3", cols === 4 && "lg:grid-cols-4")}>
      {items.map((it) => (
        <div key={it.label} className={cn("min-w-0", it.wide && "sm:col-span-2 lg:col-span-full")}>
          <dt className="text-theme-xs text-gray-500 dark:text-gray-400">{it.label}</dt>
          <dd className="mt-0.5 text-sm break-words text-gray-800 dark:text-white/90">{it.value || <span className="text-gray-400">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}
