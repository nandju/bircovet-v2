"use client";

import { useDemo } from "@/context/DemoStoreContext";
import { Link } from "@/i18n/navigation";
import { formatDate, formatXOF } from "@/lib/format";
import { payablesSummary } from "@/lib/payables";
import { cn } from "@/utils";

/** Tableau de bord : dettes fournisseurs, échu, à venir, ce que les ventes couvrent, trésorerie. */
export default function PayablesCard({ est }: { est?: string }) {
  const { db, today } = useDemo();
  const s = payablesSummary(db, today, est);
  const top = s.suppliers.slice(0, 4);
  return (
    <section className="h-full rounded-3xl border border-gray-200/70 bg-white p-5 shadow-cliva dark:border-gray-800 dark:bg-white/3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Fournisseurs et prestataires à payer</h3>
        <Link href="/achats/dettes" className="text-theme-xs font-medium text-brand-600 hover:underline dark:text-brand-400">Plan de règlement</Link>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="cliva-glow cliva-grad-gestion rounded-2xl p-3 text-white">
          <p className="text-[11px] text-white/80">Reste à payer</p>
          <p className="text-lg font-semibold tabular-nums">{formatXOF(s.total)}</p>
        </div>
        <div className={cn("rounded-2xl p-3", s.overdue ? "bg-error-50 dark:bg-error-500/10" : "bg-gray-50 dark:bg-white/5")}>
          <p className="text-[11px] text-gray-500">Échu</p>
          <p className={cn("text-lg font-semibold tabular-nums", s.overdue ? "text-error-700 dark:text-error-300" : "text-gray-900 dark:text-white")}>{formatXOF(s.overdue)}</p>
        </div>
        <div className="rounded-2xl bg-warning-50 p-3 dark:bg-warning-500/10">
          <p className="text-[11px] text-gray-500">Sous 7 jours</p>
          <p className="text-lg font-semibold text-gray-900 tabular-nums dark:text-white">{formatXOF(s.due7)}</p>
        </div>
        <div className="rounded-2xl bg-tertiary-50 p-3 dark:bg-tertiary-500/10">
          <p className="text-[11px] text-gray-500">Couvert par les ventes</p>
          <p className="text-lg font-semibold text-tertiary-700 tabular-nums dark:text-tertiary-300">{formatXOF(s.payableNow)}</p>
        </div>
      </div>
      <p className={cn("mt-2 text-theme-xs", s.afterDue < 0 ? "font-medium text-error-600" : "text-gray-500")}>
        Trésorerie {formatXOF(s.cash)} → {formatXOF(s.afterDue)} après paiement de l&apos;échu et des 7 prochains jours{s.afterDue < 0 ? " : prévoyez un étalement." : "."}
      </p>
      <ul className="mt-3 divide-y divide-gray-100 dark:divide-gray-800">
        {top.map((x) => (
          <li key={x.supplier.id}>
            <Link href={`/achats/fournisseurs/${x.supplier.id}`} className="flex items-center justify-between gap-2 py-2 hover:opacity-80">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-gray-800 dark:text-white/90">{x.supplier.name}</span>
                <span className="block text-[11px] text-gray-500">{x.nextDue ? `prochaine échéance ${formatDate(x.nextDue)}` : "dépôt-vente"}{x.payableNow > 0 ? ` · ${formatXOF(x.payableNow)} couverts par les ventes` : ""}</span>
              </span>
              <span className="text-end">
                <span className="block text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{formatXOF(x.remaining)}</span>
                {x.overdue > 0 && <span className="block text-[11px] font-medium text-error-600">{formatXOF(x.overdue)} échus</span>}
              </span>
            </Link>
          </li>
        ))}
        {!top.length && <li className="py-6 text-center text-sm text-gray-500">Aucune dette en cours.</li>}
      </ul>
    </section>
  );
}
