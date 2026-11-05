"use client";

import { usePeriod } from "@/components/margins/MarginsParts";
import { useDemo } from "@/context/DemoStoreContext";
import { Link } from "@/i18n/navigation";
import { formatXOF } from "@/lib/format";
import { FAMILY_COLORS, revenueByFamily } from "@/lib/revenue";
import { cn } from "@/utils";

/** Aperçu des recettes par famille, pour la vue financière. */
export default function RevenueFamiliesCard() {
  const { db, today } = useDemo();
  const { period, label, picker } = usePeriod("mois");
  const r = revenueByFamily(db, period, { today });
  const rows = r.rows.filter((x) => x.revenue > 0).slice(0, 6);
  const max = Math.max(1, ...rows.map((x) => x.revenue));
  return (
    <section className="rounded-3xl border border-gray-200/70 bg-white p-5 shadow-cliva dark:border-gray-800 dark:bg-white/3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Recettes par famille</h3>
          <p className="text-theme-xs text-gray-500">{label} · {formatXOF(r.total)}{r.growth !== null ? ` · ${r.growth > 0 ? "+" : ""}${r.growth} % vs période précédente` : ""} · <Link href="/finances/recettes" className="text-brand-600 hover:underline">analyse complète</Link></p>
        </div>
        {picker}
      </div>
      <ul className="space-y-2">
        {rows.map((x) => (
          <li key={x.id} className="grid grid-cols-[10rem_1fr_7rem] items-center gap-3 text-sm max-sm:grid-cols-[1fr_6rem]">
            <span className="flex items-center gap-2 truncate text-gray-700 dark:text-gray-300"><span className={cn("size-2 shrink-0 rounded-full", FAMILY_COLORS[x.color]?.dot)} />{x.name}</span>
            <span className="h-2 overflow-hidden rounded-full bg-gray-100 max-sm:hidden dark:bg-white/10"><span className={cn("block h-full rounded-full", FAMILY_COLORS[x.color]?.bar)} style={{ width: `${(x.revenue / max) * 100}%` }} /></span>
            <span className="text-end font-medium tabular-nums">{formatXOF(x.revenue)}</span>
          </li>
        ))}
        {!rows.length && <li className="text-sm text-gray-500">Aucune recette sur la période.</li>}
      </ul>
    </section>
  );
}
