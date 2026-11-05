"use client";

import { useDemo } from "@/context/DemoStoreContext";
import { Link } from "@/i18n/navigation";
import { BUCKET_META, type RevenueBucket } from "@/lib/daily";
import { formatXOF } from "@/lib/format";
import { margins, periodOf, type MarginLine, type Period } from "@/lib/margins";
import { cn } from "@/utils";
import { useState } from "react";

export type PeriodKind = "jour" | "veille" | "mois" | "annee";

/** Choix de période : aujourd'hui, hier, un mois, une année. */
export function usePeriod(initial: PeriodKind = "jour") {
  const { today } = useDemo();
  const [kind, setKind] = useState<PeriodKind>(initial);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [year, setYear] = useState(today.slice(0, 4));
  const period: Period = periodOf(kind, today, kind === "mois" ? month : kind === "annee" ? year : undefined);
  const label = kind === "jour" ? "aujourd'hui" : kind === "veille" ? "hier" : kind === "mois" ? new Date(`${month}-01T00:00:00`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) : `l'année ${year}`;
  const picker = (
    <div className="flex flex-wrap items-center gap-2">
      <div role="tablist" className="flex rounded-full bg-gray-100 p-0.5 text-theme-xs dark:bg-white/5">
        {(["jour", "veille", "mois", "annee"] as PeriodKind[]).map((k) => (
          <button key={k} role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={cn("rounded-full px-3 py-1 font-medium", kind === k ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-800 dark:text-white" : "text-gray-500")}>
            {k === "jour" ? "Aujourd'hui" : k === "veille" ? "Hier" : k === "mois" ? "Mois" : "Année"}
          </button>
        ))}
      </div>
      {kind === "mois" && <input type="month" aria-label="Mois" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="h-8 rounded-full border border-gray-200 bg-white px-3 text-theme-xs dark:border-gray-700 dark:bg-gray-900" />}
      {kind === "annee" && (
        <select aria-label="Année" value={year} onChange={(e) => setYear(e.target.value)} className="h-8 rounded-full border border-gray-200 bg-white px-3 text-theme-xs dark:border-gray-700 dark:bg-gray-900">
          {Array.from({ length: 4 }, (_, i) => String(Number(today.slice(0, 4)) - i)).map((y) => <option key={y}>{y}</option>)}
        </select>
      )}
    </div>
  );
  return { period, label, picker, kind };
}

export const rateTone = (r: number | null) => (r === null ? "text-gray-400" : r >= 30 ? "text-success-600 dark:text-success-400" : r >= 15 ? "text-warning-600 dark:text-warning-400" : "text-error-600 dark:text-error-400");

export function MarginTriplet({ m, big = false }: { m: MarginLine; big?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div><p className="text-[11px] text-gray-500">Chiffre d&apos;affaires</p><p className={cn("font-semibold tabular-nums text-gray-900 dark:text-white", big ? "text-2xl" : "text-base")}>{formatXOF(m.revenue)}</p></div>
      <div><p className="text-[11px] text-gray-500">Coût d&apos;achat</p><p className={cn("tabular-nums text-gray-600 dark:text-gray-400", big ? "text-lg" : "text-sm")}>{formatXOF(m.cost)}</p></div>
      <div><p className="text-[11px] text-gray-500">Marge</p><p className={cn("font-semibold tabular-nums", big ? "text-2xl" : "text-base", rateTone(m.rate))}>{formatXOF(m.margin)}</p><p className={cn("text-[11px] tabular-nums", rateTone(m.rate))}>{m.rate === null ? "—" : `${m.rate} %`}</p></div>
    </div>
  );
}

/** CA de la pharmacie (produits vendus, tous canaux) : jour, veille, mois, année. */
export function PharmacyRevenueCard({ est }: { est?: string }) {
  const { db } = useDemo();
  const { period, label, picker } = usePeriod("jour");
  const m = margins(db, period, est);
  const counter = db.invoices.filter((i) => i.channel === "comptoir" && i.status !== "annulee" && i.date.slice(0, 10) >= period.from && i.date.slice(0, 10) <= period.to && (!est || i.establishmentId === est));
  return (
    <section className="rounded-3xl border border-gray-200/70 bg-white p-5 shadow-cliva dark:border-gray-800 dark:bg-white/3">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Chiffre d&apos;affaires de la pharmacie</h3>
          <p className="text-theme-xs text-gray-500">{label} · comptoir et produits facturés · {counter.length} vente(s) au comptoir</p>
        </div>
        {picker}
      </div>
      <MarginTriplet m={m.buckets.pharmacie} big />
      {m.products.length > 0 && (
        <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1 text-theme-xs sm:grid-cols-2">
          {m.products.slice(0, 6).map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2"><span className="truncate text-gray-700 dark:text-gray-300">{p.name} ×{p.qty}</span><span className={cn("shrink-0 tabular-nums", rateTone(p.rate))}>{formatXOF(p.margin)} ({p.rate ?? 0} %)</span></li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Marges sur ventes et prestations, par nature. */
export function MarginsCard({ est, link = true }: { est?: string; link?: boolean }) {
  const { db } = useDemo();
  const { period, label, picker } = usePeriod("mois");
  const m = margins(db, period, est);
  const rows: [string, MarginLine, string][] = [
    ["Pharmacie (produits)", m.buckets.pharmacie, BUCKET_META.pharmacie.dot],
    ...(["consultation", "hospitalisation", "terrain", "autre"] as RevenueBucket[]).map((k) => [BUCKET_META[k].label, m.buckets[k], BUCKET_META[k].dot] as [string, MarginLine, string]),
  ];
  return (
    <section className="h-full rounded-3xl border border-gray-200/70 bg-white p-5 shadow-cliva dark:border-gray-800 dark:bg-white/3">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Marges sur ventes et prestations</h3>
          <p className="text-theme-xs text-gray-500">{label}{link && <> · <Link href="/rapports/marges" className="text-brand-600 hover:underline">détail</Link></>}</p>
        </div>
        {picker}
      </div>
      <div className="cliva-glow cliva-grad-brand rounded-2xl p-4 text-white">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <p className="text-[11px] text-white/80">CA total</p>
            <p className="text-xl font-semibold whitespace-nowrap tabular-nums">{formatXOF(m.total.revenue)}</p>
            <p className="text-[11px] whitespace-nowrap text-white/80 tabular-nums">coûts directs {formatXOF(m.total.cost)}</p>
          </div>
          <div className="text-end">
            <p className="text-[11px] text-white/80">Marge · {m.total.rate ?? 0} %</p>
            <p className="text-xl font-semibold whitespace-nowrap tabular-nums">{formatXOF(m.total.margin)}</p>
          </div>
        </div>
      </div>
      <div className="custom-scrollbar overflow-x-auto">
      <table className="mt-4 w-full text-sm [&_td]:whitespace-nowrap [&_td+td]:ps-3 [&_th+th]:ps-3">
        <thead><tr className="text-[11px] text-gray-500"><th className="py-1 text-start font-medium">Activité</th><th className="py-1 text-end font-medium">CA</th><th className="py-1 text-end font-medium">Coût</th><th className="py-1 text-end font-medium">Marge</th></tr></thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map(([l, x, dot]) => (
            <tr key={l} className={!x.revenue ? "opacity-50" : ""}>
              <td className="py-1.5 !whitespace-normal"><span className="flex items-center gap-2 text-gray-700 dark:text-gray-300"><span className={cn("size-2 rounded-full", dot)} />{l}</span></td>
              <td className="py-1.5 text-end font-medium tabular-nums text-gray-900 dark:text-white/90">{formatXOF(x.revenue)}</td>
              <td className="py-1.5 text-end text-theme-xs tabular-nums text-gray-500">{formatXOF(x.cost)}</td>
              <td className={cn("py-1.5 text-end tabular-nums", rateTone(x.rate))}>{formatXOF(x.margin)} <span className="text-[11px]">{x.rate === null ? "" : `${x.rate} %`}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <p className="mt-2 text-[11px] text-gray-500">Coût des prestations = produits administrés ou consommés pour l&apos;acte (prix d&apos;achat). Les salaires et charges fixes ne sont pas déduits.</p>
    </section>
  );
}
