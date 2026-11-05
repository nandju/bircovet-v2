import { cn } from "@/utils";

export function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-3xl p-4 shadow-cliva", accent ? "cliva-grad-brand text-white" : "border border-gray-200/70 bg-white dark:border-gray-800 dark:bg-white/3")}>
      <p className={cn("text-theme-xs", accent ? "text-white/80" : "text-gray-500")}>{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", accent ? "" : "text-gray-900 dark:text-white")}>{value}</p>
      {sub && <p className={cn("text-theme-xs", accent ? "text-white/80" : "text-gray-500")}>{sub}</p>}
    </div>
  );
}

export function Bars({ data, label }: { data: { k: string; v: number }[]; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.v));
  return (
    <div className="flex h-28 items-end gap-2" role="img" aria-label={`${label} : ${data.map((d) => `${d.k} ${d.v}`).join(", ")}`}>
      {data.map((d) => (
        <div key={d.k} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-[10px] text-gray-500 tabular-nums">{d.v}</span>
          <div className="w-full rounded-t bg-brand-500" style={{ height: `${Math.max(3, (d.v / max) * 80)}px` }} />
          <span className="text-[10px] text-gray-500">{d.k}</span>
        </div>
      ))}
    </div>
  );
}

export const MONTH_SHORT = (m: string) => ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."][Number(m.slice(5, 7)) - 1];
