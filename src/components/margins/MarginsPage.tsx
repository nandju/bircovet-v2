"use client";

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { useDemo } from "@/context/DemoStoreContext";
import { formatXOF } from "@/lib/format";
import { margins } from "@/lib/margins";
import { cn } from "@/utils";
import { MarginsCard, rateTone, usePeriod } from "./MarginsParts";

export default function MarginsPage() {
  const { db } = useDemo();
  const { period, label, picker } = usePeriod("mois");
  const m = margins(db, period);
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb pageTitle="Marges" subtitle="Ce que rapportent réellement vos ventes et vos prestations, après coût d'achat des produits" trail={[{ label: "Rapports", href: "/rapports" }]} />
      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
        <MarginsCard link={false} />
        <section className="rounded-3xl border border-gray-200/70 bg-white p-5 shadow-cliva dark:border-gray-800 dark:bg-white/3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Marge par article vendu · {label}</h3>
            {picker}
          </div>
          <div className="custom-scrollbar max-h-[34rem] overflow-auto">
            <table className="min-w-full text-sm [&_td+td]:ps-3 [&_th+th]:ps-3 [&_td]:whitespace-nowrap">
              <thead className="sticky top-0 bg-white dark:bg-gray-900"><tr className="text-theme-xs text-gray-500">{["Article", "Qté", "CA", "Coût", "Marge", "Taux"].map((h, i) => <th key={h} className={cn("py-2 font-medium", i ? "text-end" : "text-start")}>{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {m.products.map((p) => (
                  <tr key={p.id}>
                    <td className="py-1.5 pe-3 !whitespace-normal text-gray-800 dark:text-white/90">{p.name}</td>
                    <td className="py-1.5 text-end tabular-nums">{p.qty}</td>
                    <td className="py-1.5 text-end tabular-nums">{formatXOF(p.revenue)}</td>
                    <td className="py-1.5 text-end text-theme-xs tabular-nums text-gray-500">{formatXOF(p.cost)}</td>
                    <td className={cn("py-1.5 text-end font-medium tabular-nums", rateTone(p.rate))}>{formatXOF(p.margin)}</td>
                    <td className={cn("py-1.5 text-end tabular-nums", rateTone(p.rate))}>{p.rate ?? 0} %</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!m.products.length && <p className="py-8 text-center text-sm text-gray-500">Aucune vente sur la période.</p>}
          </div>
          {m.products.some((p) => (p.rate ?? 0) < 15) && <p className="mt-3 rounded-xl bg-warning-25 p-3 text-theme-xs text-warning-800 dark:bg-warning-500/10 dark:text-warning-300">Articles à faible marge (moins de 15 %) : revoyez leur prix de vente ou négociez le prix d&apos;achat.</p>}
        </section>
      </div>
    </div>
  );
}
