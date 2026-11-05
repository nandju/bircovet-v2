"use client";

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { rateTone, usePeriod } from "@/components/margins/MarginsParts";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { formatDate, formatXOF } from "@/lib/format";
import { FAMILY_COLORS, familyTrend, insights, revenueByFamily, sourceLabel, type Clientele, type FamilyRow } from "@/lib/revenue";
import { cn } from "@/utils";
import { useState } from "react";
import FamiliesEditor from "./FamiliesEditor";

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

function Growth({ g }: { g: number | null }) {
  if (g === null) return <span className="text-theme-xs text-gray-400">nouveau</span>;
  return <span className={cn("text-theme-xs font-semibold tabular-nums", g > 0 ? "text-success-600" : g < 0 ? "text-error-600" : "text-gray-500")}>{g > 0 ? "▲" : g < 0 ? "▼" : "="} {Math.abs(g)} %</span>;
}

function FamilyDetail({ r, est, clientele }: { r: FamilyRow; est?: string; clientele: Clientele }) {
  const { db, today } = useDemo();
  const trend = familyTrend(db, r.id, today, { est, clientele });
  const max = Math.max(1, ...trend.map((t) => t.revenue));
  return (
    <div className="grid grid-cols-1 gap-4 border-t border-gray-100 px-4 pt-3 pb-4 md:grid-cols-3 dark:border-gray-800">
      <div>
        <p className="mb-1 text-theme-xs font-medium text-gray-500">D&apos;où vient l&apos;argent</p>
        <ul className="space-y-0.5 text-theme-sm">
          {r.bySource.map((s) => <li key={s.key} className="flex justify-between gap-2"><span className="truncate text-gray-700 dark:text-gray-300">{sourceLabel(s.key)}</span><span className="tabular-nums">{formatXOF(s.revenue)}</span></li>)}
          {!r.bySource.length && <li className="text-gray-400">—</li>}
        </ul>
      </div>
      <div>
        <p className="mb-1 text-theme-xs font-medium text-gray-500">Ce qui se vend le plus</p>
        <ul className="space-y-0.5 text-theme-sm">
          {r.top.map((t) => <li key={t.label} className="flex justify-between gap-2"><span className="truncate text-gray-700 dark:text-gray-300">{t.label}</span><span className="tabular-nums">{formatXOF(t.revenue)}</span></li>)}
          {!r.top.length && <li className="text-gray-400">—</li>}
        </ul>
      </div>
      <div>
        <p className="mb-1 text-theme-xs font-medium text-gray-500">6 derniers mois</p>
        <div className="flex h-20 items-end gap-1.5" role="img" aria-label={`Évolution sur 6 mois : ${trend.map((t) => `${t.month} ${formatXOF(t.revenue)}`).join(", ")}`}>
          {trend.map((t) => (
            <div key={t.month} className="flex flex-1 flex-col items-center gap-1">
              <div className={cn("w-full rounded-t", FAMILY_COLORS[r.color]?.bar ?? "bg-gray-400")} style={{ height: `${Math.max(3, (t.revenue / max) * 64)}px` }} title={`${t.month} : ${formatXOF(t.revenue)}`} />
              <span className="text-[10px] text-gray-500">{MONTHS[Number(t.month.slice(5)) - 1]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function RevenuePage({ inFinance }: { inFinance?: boolean } = {}) {
  const { db, user, establishment, today } = useDemo();
  const { period, label, picker } = usePeriod("mois");
  const [clientele, setClientele] = useState<Clientele>("tous");
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [scope, setScope] = useState<"site" | "tous">("tous");
  const est = scope === "site" ? establishment?.id : undefined;
  const data = revenueByFamily(db, period, { est, clientele, today });
  const tips = insights(data.rows);
  const isDG = user?.roleId === "dg";
  const max = Math.max(1, ...data.rows.map((r) => r.revenue));
  if (editing) {
    return (
      <div className="space-y-4 md:space-y-6">
        <PageBreadcrumb pageTitle="Familles de recettes" subtitle="Regroupez vos actes et produits en grands pans d'activité" trail={[{ label: "Rapports", href: "/rapports" }, { label: "Recettes par famille", href: "/rapports/recettes" }]} />
        <FamiliesEditor onDone={() => setEditing(false)} />
      </div>
    );
  }
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb
        pageTitle="Recettes par famille"
        subtitle="Quel pan de l'activité rapporte le plus, lequel progresse, lequel pousser"
        trail={[inFinance ? { label: "Finances", href: "/finances" } : { label: "Rapports", href: "/rapports" }]}
        actions={isDG && <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Organiser les familles</Button>}
      />
      <div className="flex flex-wrap items-center gap-2">
        {picker}
        <div role="tablist" className="flex rounded-full bg-gray-100 p-0.5 text-theme-xs dark:bg-white/5">
          {(["tous", "compagnie", "rente"] as Clientele[]).map((c) => (
            <button key={c} role="tab" aria-selected={clientele === c} onClick={() => setClientele(c)} className={cn("rounded-full px-3 py-1 font-medium", clientele === c ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-800 dark:text-white" : "text-gray-500")}>
              {c === "tous" ? "Toute la clientèle" : c === "compagnie" ? "Animaux de compagnie" : "Animaux de rente"}
            </button>
          ))}
        </div>
        <div role="tablist" className="flex rounded-full bg-gray-100 p-0.5 text-theme-xs dark:bg-white/5">
          {(["tous", "site"] as const).map((c) => (
            <button key={c} role="tab" aria-selected={scope === c} onClick={() => setScope(c)} className={cn("rounded-full px-3 py-1 font-medium", scope === c ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-800 dark:text-white" : "text-gray-500")}>
              {c === "tous" ? "Tous les sites" : establishment?.name ?? "Ce site"}
            </button>
          ))}
        </div>
      </div>

      <div className="cliva-grad-brand cliva-glow flex flex-wrap items-end justify-between gap-4 rounded-3xl p-5 text-white">
        <div>
          <p className="text-theme-sm text-white/80">Recettes facturées · {label}{data.partial ? " (en cours)" : ""}</p>
          <p className="text-3xl font-bold tabular-nums">{formatXOF(data.total)}</p>
        </div>
        <div className="text-end">
          <p className="text-theme-xs text-white/80">{data.partial ? "à durée égale, vs" : "vs"} {formatDate(data.prevPeriod.from)} → {formatDate(data.prevPeriod.to)}</p>
          <p className="text-lg font-semibold tabular-nums">{data.growth === null ? "—" : `${data.growth > 0 ? "+" : ""}${data.growth} %`} <span className="text-sm font-normal text-white/80">({formatXOF(data.prevTotal)})</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_24rem]">
        <section className="rounded-3xl border border-gray-200/70 bg-white shadow-cliva dark:border-gray-800 dark:bg-white/3">
          <h3 className="px-5 pt-5 pb-2 text-base font-semibold text-gray-800 dark:text-white/90">Classement des familles</h3>
          <ul>
            {data.rows.map((r, i) => (
              <li key={r.id} className="border-t border-gray-100 first:border-t-0 dark:border-gray-800">
                <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id} className="w-full px-4 py-3 text-start hover:bg-gray-50 dark:hover:bg-white/5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="w-5 text-theme-xs font-semibold text-gray-400 tabular-nums">{i + 1}</span>
                    <span className={cn("size-2.5 rounded-full", FAMILY_COLORS[r.color]?.dot ?? "bg-gray-400")} />
                    <span className="min-w-0 flex-1 font-medium text-gray-800 dark:text-white/90">{r.name}</span>
                    <Growth g={r.growth} />
                    <span className="w-32 text-end font-semibold tabular-nums text-gray-900 dark:text-white">{formatXOF(r.revenue)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 ps-8">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                      <div className={cn("h-full rounded-full", FAMILY_COLORS[r.color]?.bar ?? "bg-gray-400")} style={{ width: `${(r.revenue / max) * 100}%` }} />
                    </div>
                    <span className="w-56 shrink-0 text-end text-theme-xs text-gray-500 tabular-nums">
                      {r.share} % · {r.count} facture(s) · marge <span className={rateTone(r.rate)}>{r.rate === null ? "—" : `${r.rate} %`}</span>
                    </span>
                  </div>
                  {r.target ? <p className="mt-1 ps-8 text-[11px] text-gray-500">Objectif {formatXOF(r.target)} · atteint à {Math.round((r.revenue / r.target) * 100)} %</p> : null}
                </button>
                {open === r.id && <FamilyDetail r={r} est={est} clientele={clientele} />}
              </li>
            ))}
          </ul>
          {!data.total && <p className="px-5 pb-8 text-center text-sm text-gray-500">Aucune recette sur la période.</p>}
          <p className="px-5 pb-4 text-[11px] text-gray-500">Recettes = montants facturés (factures validées). Marge = recette moins le prix d&apos;achat des produits vendus.</p>
        </section>

        <section className="rounded-3xl border border-gray-200/70 bg-white p-5 shadow-cliva dark:border-gray-800 dark:bg-white/3">
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Pistes d&apos;action</h3>
          <p className="mb-3 text-theme-xs text-gray-500">Suggestions tirées des chiffres de la période.</p>
          <ul className="space-y-2">
            {tips.map((t, i) => (
              <li key={i} className={cn("rounded-2xl border-s-4 px-3 py-2", t.level === "push" ? "border-success-500 bg-success-50 dark:bg-success-500/10" : t.level === "watch" ? "border-warning-500 bg-warning-50 dark:bg-warning-500/10" : "border-error-500 bg-error-50 dark:bg-error-500/10")}>
                <p className="text-sm font-semibold text-gray-800 dark:text-white/90">{t.level === "push" ? "À pousser · " : t.level === "watch" ? "À surveiller · " : "À corriger · "}{t.title}</p>
                <p className="text-theme-sm text-gray-600 dark:text-gray-400">{t.text}</p>
              </li>
            ))}
            {!tips.length && <li className="text-sm text-gray-500">Rien de marquant sur cette période : comparez sur un mois ou une année.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
