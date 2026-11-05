"use client";

import { useDemo } from "@/context/DemoStoreContext";
import { Link } from "@/i18n/navigation";
import { clientName } from "@/lib/calc";
import { BUCKET_META, counterSalesOn, receiptsOn, stockOut, yesterdayOf, type RevenueBucket } from "@/lib/daily";
import { docTotal } from "@/lib/calc";
import { formatTime, formatXOF } from "@/lib/format";
import { labelOf } from "@/lib/labels";
import { setFneNumber } from "@/lib/services/invoicesService";
import { cn } from "@/utils";
import { useState } from "react";

const Delta = ({ cur, prev }: { cur: number; prev: number }) => {
  if (!prev) return <span className="text-theme-xs text-gray-500">hier : {formatXOF(prev)}</span>;
  const d = Math.round(((cur - prev) / prev) * 100);
  return (
    <span className="text-theme-xs text-gray-500">
      <span className={cn("me-1 rounded-full px-1.5 py-0.5 font-medium", d >= 0 ? "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-300" : "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-300")}>{d >= 0 ? "+" : ""}{d} %</span>
      vs hier ({formatXOF(prev)})
    </span>
  );
};

/** Recette du jour (encaissements) : pharmacie vs actes physiques. */
export function ReceiptsCard({ est }: { est?: string }) {
  const { db, today } = useDemo();
  const [day, setDay] = useState<"j" | "j1">("j");
  const d = day === "j" ? today : yesterdayOf(today);
  const r = receiptsOn(db, d, est);
  const prev = receiptsOn(db, yesterdayOf(d), est);
  const keys = (Object.keys(BUCKET_META) as RevenueBucket[]).filter((k) => r.buckets[k] > 0);
  const actes = r.buckets.consultation + r.buckets.hospitalisation + r.buckets.terrain;
  return (
    <section className="h-full rounded-3xl border border-gray-200/70 bg-white p-5 shadow-cliva dark:border-gray-800 dark:bg-white/3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Recette {day === "j" ? "du jour" : "d'hier"}</h3>
        <div role="tablist" className="flex rounded-full bg-gray-100 p-0.5 text-theme-xs dark:bg-white/5">
          {(["j", "j1"] as const).map((k) => (
            <button key={k} role="tab" aria-selected={day === k} onClick={() => setDay(k)} className={cn("rounded-full px-3 py-1 font-medium", day === k ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-800 dark:text-white" : "text-gray-500")}>{k === "j" ? "Aujourd'hui" : "Hier"}</button>
          ))}
        </div>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-gray-900 tabular-nums dark:text-white">{formatXOF(r.total)}</p>
      <div className="mt-1"><Delta cur={r.total} prev={prev.total} /></div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="cliva-glow cliva-grad-gestion rounded-2xl p-3 text-white">
          <p className="text-theme-xs text-white/80">Pharmacie</p>
          <p className="text-lg font-semibold tabular-nums">{formatXOF(r.buckets.pharmacie)}</p>
          <p className="text-[11px] text-white/75">{r.total ? Math.round((r.buckets.pharmacie / r.total) * 100) : 0} % de la recette</p>
        </div>
        <div className="cliva-glow cliva-grad-brand rounded-2xl p-3 text-white">
          <p className="text-theme-xs text-white/80">Actes (consultations, soins, terrain)</p>
          <p className="text-lg font-semibold tabular-nums">{formatXOF(actes)}</p>
          <p className="text-[11px] text-white/75">{r.total ? Math.round((actes / r.total) * 100) : 0} % de la recette</p>
        </div>
      </div>
      <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10" aria-hidden>
        {keys.map((k) => <div key={k} className={cn("h-full transition-[width] duration-700", BUCKET_META[k].bar)} style={{ width: `${(r.buckets[k] / (r.total || 1)) * 100}%` }} />)}
      </div>
      <ul className="mt-3 space-y-1.5 text-sm">
        {(Object.keys(BUCKET_META) as RevenueBucket[]).map((k) => (
          <li key={k} className={cn("flex items-center justify-between gap-2", !r.buckets[k] && "opacity-50")}>
            <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300"><span className={cn("size-2 rounded-full", BUCKET_META[k].dot)} />{BUCKET_META[k].label}</span>
            <span className="font-medium text-gray-900 tabular-nums dark:text-white/90">{formatXOF(r.buckets[k])}</span>
          </li>
        ))}
      </ul>
      {r.methods.length > 0 && <p className="mt-3 text-theme-xs text-gray-500">{r.count} encaissement(s) · {r.methods.map(([m, v]) => `${labelOf("paymentMethod", m)} ${formatXOF(v)}`).join(" · ")}</p>}
    </section>
  );
}

/** Valeur du stock sorti hier et aujourd'hui (prix d'achat et prix de vente). */
export function StockOutCard({ est }: { est?: string }) {
  const { db, today } = useDemo();
  const [day, setDay] = useState<"j" | "j1">("j");
  const j = stockOut(db, today, est);
  const j1 = stockOut(db, yesterdayOf(today), est);
  const cur = day === "j" ? j : j1;
  return (
    <section className="h-full rounded-3xl border border-gray-200/70 bg-white p-5 shadow-cliva dark:border-gray-800 dark:bg-white/3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Stock sorti</h3>
        <Link href="/stock/mouvements" className="text-theme-xs font-medium text-brand-600 hover:underline dark:text-brand-400">Mouvements</Link>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {([["j", "Aujourd'hui", j], ["j1", "Hier", j1]] as const).map(([k, l, x]) => (
          <button key={k} type="button" onClick={() => setDay(k)} aria-pressed={day === k} className={cn("cliva-press rounded-2xl border p-3 text-start transition", day === k ? "border-transparent bg-linear-to-br from-tertiary-50 to-white ring-2 ring-tertiary-400 dark:from-tertiary-500/10 dark:to-transparent" : "border-gray-200 dark:border-gray-700")}>
            <p className="text-theme-xs text-gray-500">{l}</p>
            <p className="text-xl font-semibold text-gray-900 tabular-nums dark:text-white">{formatXOF(x.sale)}</p>
            <p className="text-[11px] text-gray-500">en prix de vente · achat {formatXOF(x.cost)} · marge {formatXOF(x.sale - x.cost)}</p>
          </button>
        ))}
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {cur.byType.map((t) => (
          <li key={t.type} className="flex items-center justify-between gap-2">
            <span className="text-gray-700 dark:text-gray-300">{t.label}</span>
            <span className="text-end tabular-nums"><span className="block font-medium text-gray-900 dark:text-white/90">{formatXOF(t.sale)}</span><span className="block text-[11px] text-gray-500">achat {formatXOF(t.cost)}</span></span>
          </li>
        ))}
        {!cur.byType.length && <li className="py-2 text-center text-theme-xs text-gray-500">Aucune sortie.</li>}
      </ul>
      {cur.top.length > 0 && <p className="mt-2 line-clamp-2 text-theme-xs text-gray-500">Principaux produits : {cur.top.slice(0, 4).map((p) => `${p.name} (${p.qty})`).join(", ")}</p>}
    </section>
  );
}

export function FneInput({ id, value }: { id: string; value?: string }) {
  const { run } = useDemo();
  const [v, setV] = useState(value ?? "");
  const [edit, setEdit] = useState(!value);
  if (!edit) return <button type="button" onClick={() => setEdit(true)} className="rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-medium text-success-700 dark:bg-success-500/15 dark:text-success-300" title="Modifier">FNE {value}</button>;
  return (
    <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); if (v.trim() && run(setFneNumber, { id, number: v }).ok) setEdit(false); }}>
      <input aria-label="Numéro FNE" value={v} onChange={(e) => setV(e.target.value)} placeholder="N° FNE" className="h-7 w-28 rounded-full border border-warning-300 bg-warning-25 px-2.5 text-theme-xs uppercase dark:border-warning-500/40 dark:bg-transparent" />
      <button type="submit" className="h-7 rounded-full bg-gray-900 px-2.5 text-[11px] font-medium text-white dark:bg-white dark:text-gray-900">OK</button>
    </form>
  );
}

/** Ventes au comptoir du jour, avec saisie du numéro FNE après coup. */
export function CounterSalesToday({ est, compact = false }: { est?: string; compact?: boolean }) {
  const { db, today } = useDemo();
  const [day, setDay] = useState<"j" | "j1">("j");
  const list = counterSalesOn(db, day === "j" ? today : yesterdayOf(today), est);
  const total = list.reduce((s, i) => s + docTotal(i.lines), 0);
  const missing = list.filter((i) => !i.fneNumber).length;
  return (
    <section className="h-full rounded-3xl border border-gray-200/70 bg-white p-5 shadow-cliva dark:border-gray-800 dark:bg-white/3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Ventes au comptoir</h3>
          <p className="text-theme-xs text-gray-500">{list.length} vente(s) · {formatXOF(total)}{missing ? <span className="ms-1 font-medium text-warning-700 dark:text-warning-400">· {missing} FNE à saisir</span> : list.length ? " · FNE complètes" : ""}</p>
        </div>
        <div role="tablist" className="flex rounded-full bg-gray-100 p-0.5 text-theme-xs dark:bg-white/5">
          {(["j", "j1"] as const).map((k) => (
            <button key={k} role="tab" aria-selected={day === k} onClick={() => setDay(k)} className={cn("rounded-full px-3 py-1 font-medium", day === k ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-800 dark:text-white" : "text-gray-500")}>{k === "j" ? "Aujourd'hui" : "Hier"}</button>
          ))}
        </div>
      </div>
      <ul className={cn("mt-3 divide-y divide-gray-100 dark:divide-gray-800", compact && "max-h-80 overflow-y-auto custom-scrollbar")}>
        {list.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
            <span className="w-12 text-theme-xs text-gray-500 tabular-nums">{formatTime(i.validatedAt ?? i.date)}</span>
            <span className="min-w-0 flex-1">
              <Link href={`/facturation/factures/${i.id}`} className="block truncate text-sm font-medium text-gray-800 hover:underline dark:text-white/90">{i.code} · {i.saleInfo?.contact?.name || clientName(db, i.clientId)}{i.saleInfo?.contact?.phone ? ` · ${i.saleInfo.contact.phone}` : ""}</Link>
              <span className="block truncate text-[11px] text-gray-500">{i.lines.map((l) => `${l.label} ×${l.qty}`).join(", ")}{i.saleInfo?.species ? ` · ${i.saleInfo.species}` : ""}</span>
            </span>
            <span className="text-sm font-semibold text-gray-900 tabular-nums dark:text-white">{formatXOF(docTotal(i.lines))}</span>
            <FneInput key={`${i.id}-${i.fneNumber ?? ""}`} id={i.id} value={i.fneNumber} />
          </li>
        ))}
        {!list.length && <li className="py-6 text-center text-sm text-gray-500">Aucune vente au comptoir.</li>}
      </ul>
    </section>
  );
}
