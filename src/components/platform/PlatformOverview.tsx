"use client";

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { useDemo } from "@/context/DemoStoreContext";
import { Link } from "@/i18n/navigation";
import { formatXOF } from "@/lib/format";
import { campaignLive, campaignTotals, maintenanceState, MAINT_LABEL, months, platformMoney, usageOf } from "@/lib/platform";
import { cn } from "@/utils";
import { Bars, Kpi, MONTH_SHORT } from "./Kpi";

export default function PlatformOverview() {
  const { db, today } = useDemo();
  const p = db.platform;
  if (!p) return <p className="text-sm text-gray-500">Plateforme non initialisée.</p>;
  const money = platformMoney(db, today);
  const active = p.clinics.filter((c) => c.status === "actif");
  const ms = months(today, 6);
  const cur = ms[ms.length - 1];
  const usage = ms.map((m) => ({ k: MONTH_SHORT(m), v: active.reduce((s, c) => s + (usageOf(db, c, m)?.consultations ?? 0), 0) }));
  const thisMonth = active.map((c) => usageOf(db, c, cur)).filter(Boolean);
  const sum = (k: "activeUsers" | "consultations" | "sales" | "appointments") => thisMonth.reduce((s, u) => s + (u?.[k] ?? 0), 0);
  const attention = p.clinics
    .filter((c) => c.status !== "prospect")
    .map((c) => ({ c, m: maintenanceState(c, today, p.offer.graceDays), u: usageOf(db, c, cur) }))
    .filter((x) => x.m.state === "en_retard" || x.m.state === "a_renouveler" || (x.u?.activeUsers ?? 0) === 0 || x.c.licencePrice > x.c.payments.filter((y) => y.kind === "licence").reduce((s, y) => s + y.amount, 0));
  const countries = [...new Set(p.clinics.filter((c) => c.status !== "prospect").map((c) => c.country))];
  const camps = p.campaigns.filter((c) => campaignLive(c, today));
  const ads = p.campaigns.map(campaignTotals).reduce((s, t) => ({ views: s.views + t.views, clicks: s.clicks + t.clicks }), { views: 0, clicks: 0 });
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb pageTitle="Console éditeur Cliva" subtitle="Vos cliniques clientes, vos licences, l'usage de la plateforme et vos campagnes" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi accent label="Cliniques actives" value={`${active.length}`} sub={`${p.clinics.filter((c) => c.status === "prospect").length} prospect(s) · ${countries.length} pays`} />
        <Kpi label="Licences encaissées" value={formatXOF(money.licences)} sub={`reste à encaisser ${formatXOF(money.receivable)}`} />
        <Kpi label="Maintenance récurrente" value={`${formatXOF(money.monthlyRecurring)} / mois`} sub={`${formatXOF(money.yearMaintenance)} encaissés cette année`} />
        <Kpi label="Pubs diffusées" value={`${camps.length} campagne(s)`} sub={`${ads.views} vues · ${ads.clicks} clics`} />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-3xl border border-gray-200/70 bg-white p-5 shadow-cliva dark:border-gray-800 dark:bg-white/3">
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Usage de la plateforme</h3>
          <p className="mb-3 text-theme-xs text-gray-500">Consultations enregistrées par toutes les cliniques actives, 6 derniers mois</p>
          <Bars data={usage} label="Consultations par mois" />
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            {[["Utilisateurs actifs", sum("activeUsers")], ["Consultations", sum("consultations")], ["Rendez-vous", sum("appointments")], ["Ventes comptoir", sum("sales")]].map(([l, v]) => (
              <div key={l} className="rounded-2xl bg-gray-50 px-3 py-2 dark:bg-white/5"><p className="text-theme-xs text-gray-500">{l} (ce mois)</p><p className="text-lg font-semibold tabular-nums text-gray-900 dark:text-white">{v}</p></div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-gray-500">Données anonymisées : des comptages uniquement. Aucun nom de client, aucun dossier médical, aucun montant de facture des cliniques.</p>
        </section>
        <section className="rounded-3xl border border-gray-200/70 bg-white p-5 shadow-cliva dark:border-gray-800 dark:bg-white/3">
          <div className="mb-3 flex items-center justify-between"><h3 className="text-base font-semibold text-gray-800 dark:text-white/90">À suivre</h3><Link href="/editeur/cliniques" className="text-theme-sm font-medium text-brand-600 hover:underline dark:text-brand-400">Toutes les cliniques</Link></div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {attention.map(({ c, m, u }) => {
              const left = c.licencePrice - c.payments.filter((y) => y.kind === "licence").reduce((s, y) => s + y.amount, 0);
              return (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <Link href={`/editeur/cliniques?c=${c.id}`} className="min-w-0">
                    <span className="block font-medium text-gray-800 hover:text-brand-600 dark:text-white/90">{c.name}</span>
                    <span className="block text-theme-xs text-gray-500">{c.city}, {c.country}</span>
                  </Link>
                  <span className="flex flex-wrap justify-end gap-1">
                    {(m.state === "en_retard" || m.state === "a_renouveler") && <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", MAINT_LABEL[m.state].tone)}>{MAINT_LABEL[m.state].label}</span>}
                    {left > 0 && <span className="rounded-full bg-warning-50 px-2 py-0.5 text-[11px] font-medium text-warning-700 dark:bg-warning-500/15 dark:text-warning-300">Licence : reste {formatXOF(left)}</span>}
                    {(u?.activeUsers ?? 0) === 0 && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-white/10 dark:text-gray-400">Aucune activité ce mois</span>}
                  </span>
                </li>
              );
            })}
            {!attention.length && <li className="py-6 text-center text-sm text-gray-500">Tout est en ordre.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
