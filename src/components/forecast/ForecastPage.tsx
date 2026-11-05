"use client";

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useRouter } from "@/i18n/navigation";
import { activeLines, STOCK_CATEGORY } from "@/lib/budgets";
import { supplierName } from "@/lib/calc";
import { forecast, type ForecastRow } from "@/lib/forecast";
import { addDays, formatDate, formatXOF, uid } from "@/lib/format";
import { createPurchaseOrder } from "@/lib/services/suppliersService";
import { cn } from "@/utils";
import { useMemo, useState } from "react";

function Spark({ data }: { data: number[] }) {
  const max = Math.max(1, ...data);
  return (
    <span className="inline-flex h-6 items-end gap-px" aria-label={`Ventes des 12 dernières semaines : ${data.join(", ")}`}>
      {data.map((v, i) => <span key={i} className={cn("w-1.5 rounded-sm", i >= 8 ? "bg-tertiary-500" : "bg-tertiary-200 dark:bg-tertiary-500/40")} style={{ height: `${Math.max(8, (v / max) * 100)}%` }} />)}
    </span>
  );
}

const Trend = ({ v }: { v: number }) => <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums", v > 10 ? "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-300" : v < -10 ? "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-300" : "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300")}>{v > 0 ? "▲" : v < 0 ? "▼" : "="} {Math.abs(v)} %</span>;

/** Prévisions de commande fournisseur d'après l'évolution des ventes. */
export default function ForecastPage() {
  const { db, run, today, establishment, can } = useDemo();
  const router = useRouter();
  const [horizon, setHorizon] = useState(30);
  const [lead, setLead] = useState(7);
  const [onlyNeeded, setOnlyNeeded] = useState(true);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [budgetLine, setBudgetLine] = useState<Record<string, string>>({});
  const rows = useMemo(() => forecast(db, today, { horizon, leadTime: lead, est: establishment?.id }), [db, today, horizon, lead, establishment?.id]);
  const shown = rows.filter((r) => !onlyNeeded || r.suggested > 0);
  const groups = new Map<string, ForecastRow[]>();
  for (const r of shown) groups.set(r.product.supplierId, [...(groups.get(r.product.supplierId) ?? []), r]);
  const q = (r: ForecastRow) => qty[r.product.id] ?? r.suggested;
  const lines = activeLines(db, today, establishment?.id).filter((x) => x.line.category === STOCK_CATEGORY);
  const totalAll = shown.reduce((s, r) => s + q(r) * r.product.purchasePrice, 0);
  const order = (supplierId: string, list: ForecastRow[]) => {
    const l = list.filter((r) => q(r) > 0).map((r) => ({ id: uid("pol"), productId: r.product.id, qtyOrdered: q(r), unitPrice: r.product.purchasePrice }));
    const res = run(createPurchaseOrder, { supplierId, expectedDate: addDays(today, lead), lines: l, notes: `Commande issue des prévisions (couverture ${horizon} j, délai ${lead} j).`, budgetLineId: budgetLine[supplierId] || undefined });
    if (res.ok && res.data) router.push(`/achats/commandes/${res.data}`);
  };
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb pageTitle="Prévisions de commande" subtitle="Ce qu'il faut commander, chez qui, d'après l'évolution de vos ventes et consommations" trail={[{ label: "Achats", href: "/achats" }]} />
      <section className="cliva-glow cliva-grad-gestion rounded-3xl p-5 text-white shadow-cliva">
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <p className="text-theme-xs text-white/80">Commandes suggérées</p>
            <p className="text-3xl font-semibold tabular-nums">{formatXOF(totalAll)}</p>
            <p className="text-theme-xs text-white/80">{shown.filter((r) => q(r) > 0).length} article(s) · {groups.size} fournisseur(s) · {rows.filter((r) => r.urgent).length} rupture(s) imminente(s)</p>
          </div>
          <label className="text-theme-xs text-white/85">Jours à couvrir
            <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} className="mt-1 block h-9 rounded-full border-0 bg-white/20 px-3 text-sm text-white ring-1 ring-white/30">
              {[15, 30, 45, 60, 90].map((n) => <option key={n} value={n} className="text-gray-900">{n} jours</option>)}
            </select>
          </label>
          <label className="text-theme-xs text-white/85">Délai de livraison
            <select value={lead} onChange={(e) => setLead(Number(e.target.value))} className="mt-1 block h-9 rounded-full border-0 bg-white/20 px-3 text-sm text-white ring-1 ring-white/30">
              {[2, 3, 5, 7, 10, 14, 21].map((n) => <option key={n} value={n} className="text-gray-900">{n} jours</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-theme-xs text-white/90"><input type="checkbox" checked={onlyNeeded} onChange={(e) => setOnlyNeeded(e.target.checked)} className="accent-white" />Seulement ce qu&apos;il faut commander</label>
        </div>
        <p className="mt-3 max-w-3xl text-[11px] text-white/75">Calcul : consommation des 30 derniers jours (pondérée avec les 90 jours) corrigée de la tendance, × (jours à couvrir + délai), + seuil d&apos;alerte, − stock, − commandes déjà envoyées. Arrondi à l&apos;unité d&apos;achat.</p>
      </section>
      {[...groups.entries()].map(([sid, list]) => {
        const sum = list.reduce((s, r) => s + q(r) * r.product.purchasePrice, 0);
        return (
          <section key={sid} className="cliva-rise overflow-hidden rounded-3xl border border-gray-200/70 bg-white shadow-cliva dark:border-gray-800 dark:bg-white/3">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-3 dark:border-gray-800">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">{supplierName(db, sid)}</h3>
                <p className="text-theme-xs text-gray-500">{list.length} article(s) · {formatXOF(sum)} · livraison souhaitée le {formatDate(addDays(today, lead))}</p>
              </div>
              {can("achats", "create") && (
                <div className="flex flex-wrap items-center gap-2">
                  <select aria-label="Ligne de budget" value={budgetLine[sid] ?? ""} onChange={(e) => setBudgetLine({ ...budgetLine, [sid]: e.target.value })} className="h-9 max-w-64 rounded-full border border-gray-200 bg-white px-3 text-theme-xs dark:border-gray-700 dark:bg-gray-900">
                    <option value="">Sans budget (aval DG)</option>
                    {lines.map((x) => <option key={x.line.id} value={x.line.id}>{x.line.label} — reste {x.left.toLocaleString("fr-FR")}</option>)}
                  </select>
                  <Button size="sm" disabled={!sum} onClick={() => order(sid, list)}>Créer la commande</Button>
                </div>
              )}
            </header>
            <div className="custom-scrollbar overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-theme-xs text-gray-500">
                    {["Article", "Ventes 12 sem.", "30 j", "Tendance", "Stock", "Couverture", "En commande", "À commander", "Coût"].map((h, i) => <th key={h} className={cn("px-3 py-2 font-medium", i > 1 ? "text-end" : "text-start")}>{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {list.map((r) => (
                    <tr key={r.product.id} className={r.urgent ? "bg-error-25 dark:bg-error-500/5" : ""}>
                      <td className="px-3 py-2"><span className="block font-medium text-gray-800 dark:text-white/90">{r.product.name}</span><span className="block text-[11px] text-gray-500">{r.product.stockUnit} · {r.product.conversion > 1 ? `par ${r.product.conversion}` : "à l'unité"}</span></td>
                      <td className="px-3 py-2"><Spark data={r.weekly} /></td>
                      <td className="px-3 py-2 text-end tabular-nums">{r.q30}</td>
                      <td className="px-3 py-2 text-end"><Trend v={r.trend} /></td>
                      <td className="px-3 py-2 text-end tabular-nums">{r.stock}</td>
                      <td className={cn("px-3 py-2 text-end tabular-nums", r.urgent && "font-semibold text-error-600")}>{r.coverDays === null ? "—" : `${r.coverDays} j`}{r.stockoutDate && r.coverDays !== null && r.coverDays < 120 && <span className="block text-[11px] font-normal text-gray-500">rupture ~{formatDate(r.stockoutDate)}</span>}</td>
                      <td className="px-3 py-2 text-end tabular-nums">{r.pending || "—"}</td>
                      <td className="px-3 py-2 text-end"><input aria-label={`Quantité ${r.product.name}`} type="number" min={0} step={Math.max(1, r.product.conversion)} value={q(r)} onChange={(e) => setQty({ ...qty, [r.product.id]: Math.max(0, Number(e.target.value)) })} className="h-8 w-20 rounded-lg border border-gray-300 bg-transparent px-2 text-end tabular-nums dark:border-gray-700" /></td>
                      <td className="px-3 py-2 text-end tabular-nums">{formatXOF(q(r) * r.product.purchasePrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
      {!groups.size && <p className="rounded-3xl border border-dashed border-gray-200 px-5 py-10 text-center text-sm text-gray-500 dark:border-gray-700">Rien à commander sur cette période : le stock couvre les ventes prévues.</p>}
    </div>
  );
}
