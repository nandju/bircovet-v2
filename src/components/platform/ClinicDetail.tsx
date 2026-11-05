"use client";

import AppModal from "@/components/common/AppModal";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { formatDate, formatXOF } from "@/lib/format";
import { CLIENTELE_LABEL, LANG_LABEL, licencePaid, maintenanceState, MAINT_LABEL, months, targets, usageOf, USAGE_MODULES } from "@/lib/platform";
import { recordPlatformPayment, setClinicStatus } from "@/lib/services/platformService";
import type { PlatformClinic } from "@/lib/types";
import { cn } from "@/utils";
import { useState } from "react";
import { Bars, MONTH_SHORT } from "./Kpi";

const inp = "h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:text-white/90";

export default function ClinicDetail({ c, onClose, onEdit }: { c: PlatformClinic; onClose: () => void; onEdit: () => void }) {
  const { db, run, today } = useDemo();
  const p = db.platform!;
  const [kind, setKind] = useState<"licence" | "maintenance">("maintenance");
  const [amount, setAmount] = useState(c.maintenanceAmount);
  const [periods, setPeriods] = useState(1);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const paid = licencePaid(c);
  const m = maintenanceState(c, today, p.offer.graceDays);
  const ms = months(today, 6);
  const cur = usageOf(db, c, ms[ms.length - 1]);
  const mods = Object.entries(cur?.modules ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxMod = Math.max(1, ...mods.map((x) => x[1]));
  const camps = p.campaigns.filter((x) => targets(x, c));
  return (
    <AppModal isOpen onClose={onClose} size="xl" title={c.name} description={`${c.city}, ${c.country} · ${LANG_LABEL[c.language]} · ${CLIENTELE_LABEL[c.clientele]} · ${c.users} utilisateur(s), ${c.sites} site(s) · version ${c.version}`}>
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <span className={cn("rounded-full px-2.5 py-1 text-theme-xs font-medium", c.status === "actif" ? "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-300" : c.status === "suspendu" ? "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-300" : "bg-gray-100 text-gray-600 dark:bg-white/10")}>{c.status === "actif" ? "Active" : c.status === "suspendu" ? "Suspendue" : "Prospect"}</span>
          <span className={cn("rounded-full px-2.5 py-1 text-theme-xs font-medium", MAINT_LABEL[m.state].tone)}>{MAINT_LABEL[m.state].label}{c.paidUntil && ` · jusqu'au ${formatDate(c.paidUntil)}`}</span>
          <Button size="xs" variant="ghost" onClick={onEdit}>Modifier la fiche</Button>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="space-y-3 rounded-2xl bg-gray-50 p-4 dark:bg-white/5">
            <h4 className="text-sm font-semibold text-gray-800 dark:text-white/90">Licence et maintenance</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <p className="text-gray-500">Licence vendue</p><p className="text-end font-medium tabular-nums">{formatXOF(c.licencePrice)}{c.soldAt && <span className="block text-theme-xs text-gray-500">le {formatDate(c.soldAt)}</span>}</p>
              <p className="text-gray-500">Encaissé</p><p className="text-end font-medium tabular-nums">{formatXOF(paid)}</p>
              <p className="text-gray-500">Reste à encaisser</p><p className={cn("text-end font-semibold tabular-nums", c.licencePrice - paid > 0 ? "text-warning-600" : "text-success-600")}>{formatXOF(Math.max(0, c.licencePrice - paid))}</p>
              <p className="text-gray-500">Maintenance</p><p className="text-end tabular-nums">{formatXOF(c.maintenanceAmount)} / {c.maintenancePeriod === "annuel" ? "an" : "mois"}</p>
            </div>
            <form className="space-y-2 border-t border-gray-200 pt-3 dark:border-gray-700" onSubmit={(e) => { e.preventDefault(); if (run(recordPlatformPayment, { clinicId: c.id, kind, amount, date, periods, note }).ok) setNote(""); }}>
              <p className="text-theme-xs font-semibold tracking-wide text-gray-500 uppercase">Enregistrer un paiement</p>
              <div className="flex flex-wrap gap-2">
                <select value={kind} onChange={(e) => { const k = e.target.value as "licence" | "maintenance"; setKind(k); setAmount(k === "licence" ? Math.max(0, c.licencePrice - paid) : c.maintenanceAmount); }} className={cn(inp, "dark:bg-gray-900")} aria-label="Type de paiement">
                  <option value="maintenance">Maintenance</option>
                  <option value="licence">Licence (vente)</option>
                </select>
                <input type="number" min={0} step={5000} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className={cn(inp, "w-36")} aria-label="Montant" />
                {kind === "maintenance" && (
                  <select value={periods} onChange={(e) => { const n = Number(e.target.value); setPeriods(n); setAmount(c.maintenanceAmount * n); }} className={cn(inp, "dark:bg-gray-900")} aria-label="Nombre de périodes">
                    {[1, 2, 3, 6, 12].map((n) => <option key={n} value={n}>{n} {c.maintenancePeriod === "annuel" ? "an(s)" : "mois"}</option>)}
                  </select>
                )}
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp} aria-label="Date" />
              </div>
              <div className="flex gap-2">
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (référence du virement…)" className={cn(inp, "min-w-0 flex-1")} aria-label="Note" />
                <Button size="sm" type="submit" disabled={!(amount > 0)}>Enregistrer</Button>
              </div>
            </form>
            {c.payments.length > 0 && (
              <ul className="max-h-36 space-y-1 overflow-y-auto text-theme-sm">
                {[...c.payments].reverse().map((x) => (
                  <li key={x.id} className="flex justify-between gap-2"><span className="text-gray-600 dark:text-gray-400">{formatDate(x.date)} · {x.kind === "licence" ? "Licence" : `Maintenance${x.coversUntil ? ` → ${formatDate(x.coversUntil)}` : ""}`}</span><span className="tabular-nums">{formatXOF(x.amount)}</span></li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3 rounded-2xl bg-gray-50 p-4 dark:bg-white/5">
            <h4 className="text-sm font-semibold text-gray-800 dark:text-white/90">Usage (anonymisé)</h4>
            <Bars data={ms.map((x) => ({ k: MONTH_SHORT(x), v: usageOf(db, c, x)?.actions ?? 0 }))} label="Actions par mois" />
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[["Utilisateurs actifs", cur?.activeUsers], ["Consultations", cur?.consultations], ["Rendez-vous", cur?.appointments], ["Ventes comptoir", cur?.sales]].map(([l, v]) => (
                <p key={l as string} className="flex justify-between"><span className="text-gray-500">{l}</span><span className="font-medium tabular-nums">{v ?? 0}</span></p>
              ))}
            </div>
            <div>
              <p className="mb-1 text-theme-xs text-gray-500">Modules les plus utilisés ce mois</p>
              {mods.map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 text-theme-xs">
                  <span className="w-28 truncate text-gray-600 dark:text-gray-400">{USAGE_MODULES[k] ?? k}</span>
                  <div className="h-1.5 flex-1 rounded-full bg-gray-200 dark:bg-white/10"><div className="h-full rounded-full bg-brand-500" style={{ width: `${(v / maxMod) * 100}%` }} /></div>
                  <span className="w-8 text-end tabular-nums">{v}</span>
                </div>
              ))}
              {!mods.length && <p className="text-theme-xs text-gray-400">Pas d&apos;activité enregistrée.</p>}
            </div>
          </section>
        </div>

        <section>
          <h4 className="mb-2 text-sm font-semibold text-gray-800 dark:text-white/90">Campagnes affichées dans cette clinique</h4>
          <ul className="space-y-1 text-sm">
            {camps.map((x) => <li key={x.id} className="flex justify-between gap-2"><span>{x.title} <span className="text-gray-500">· {x.sponsor}</span></span><span className="text-theme-xs tabular-nums text-gray-500">{x.stats[c.id]?.views ?? 0} vues · {x.stats[c.id]?.clicks ?? 0} clics</span></li>)}
            {!camps.length && <li className="text-gray-500">Aucune.</li>}
          </ul>
        </section>

        {!c.isSelf && (
          <section className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
            {c.status === "suspendu" ? (
              <Button size="sm" variant="outline" onClick={() => run(setClinicStatus, { id: c.id, status: "actif" })}>Réactiver</Button>
            ) : (
              <>
                <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motif de suspension (ex. : maintenance impayée)" className={cn(inp, "min-w-0 flex-1")} aria-label="Motif de suspension" />
                <Button size="sm" variant="outline" className="text-error-600" disabled={!reason.trim()} onClick={() => run(setClinicStatus, { id: c.id, status: "suspendu", note: reason }).ok && setReason("")}>Suspendre le support</Button>
              </>
            )}
          </section>
        )}
        {c.notes && <p className="whitespace-pre-line rounded-xl bg-gray-50 px-3 py-2 text-theme-sm text-gray-600 dark:bg-white/5 dark:text-gray-400">{c.notes}</p>}
      </div>
    </AppModal>
  );
}
