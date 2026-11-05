"use client";

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useQueryParam } from "@/hooks/useQueryFlag";
import { PlusIcon } from "@/icons";
import { formatDate, formatXOF, normalize } from "@/lib/format";
import { CLIENTELE_LABEL, LANG_LABEL, licencePaid, maintenanceState, MAINT_LABEL, months, usageOf } from "@/lib/platform";
import type { ClinicInput } from "@/lib/services/platformService";
import { cn } from "@/utils";
import { exportCsv } from "@/utils/export";
import { useEffect, useState } from "react";
import ClinicDetail from "./ClinicDetail";
import ClinicModal from "./ClinicModal";

export default function ClinicsPage() {
  const { db, today } = useDemo();
  const p = db.platform;
  const param = useQueryParam("c");
  const [open, setOpen] = useState<string | null>(null);
  const [edit, setEdit] = useState<ClinicInput | null>(null);
  const [q, setQ] = useState("");
  const [f, setF] = useState({ country: "", language: "", status: "", maint: "" });
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ouverture depuis un lien
    if (param) setOpen(param);
  }, [param]);
  if (!p) return null;
  const cur = months(today, 1)[0];
  const t = normalize(q);
  const rows = p.clinics.filter((c) => (!t || normalize(`${c.name} ${c.city} ${c.contactName}`).includes(t)) && (!f.country || c.country === f.country) && (!f.language || c.language === f.language) && (!f.status || c.status === f.status) && (!f.maint || maintenanceState(c, today, p.offer.graceDays).state === f.maint));
  const blank: ClinicInput = { name: "", country: "Côte d'Ivoire", city: "", language: "fr", clientele: "mixte", contactName: "", phone: "", email: "", status: "prospect", licencePrice: p.offer.licencePrice, maintenanceAmount: p.offer.maintenanceAmount, maintenancePeriod: p.offer.maintenancePeriod, users: 3, sites: 1, version: "2.0" };
  const sel = "h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white";
  const current = p.clinics.find((c) => c.id === open);
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb
        pageTitle="Cliniques clientes"
        subtitle={`${p.clinics.length} clinique(s) · ${[...new Set(p.clinics.map((c) => c.country))].length} pays`}
        trail={[{ label: "Console éditeur", href: "/editeur" }]}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => exportCsv("cliva-cliniques", ["Clinique", "Pays", "Ville", "Langue", "Statut", "Licence", "Encaissé", "Maintenance jusqu'au", "Utilisateurs actifs (mois)"], rows.map((c) => [c.name, c.country, c.city, LANG_LABEL[c.language], c.status, String(c.licencePrice), String(licencePaid(c)), c.paidUntil ?? "", String(usageOf(db, c, cur)?.activeUsers ?? 0)]))}>Export CSV</Button>
            <Button size="sm" startIcon={<PlusIcon />} onClick={() => setEdit(blank)}>Nouvelle clinique</Button>
          </>
        }
      />
      <div className="flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, ville, contact…" aria-label="Rechercher" className="h-9 min-w-48 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
        <select className={sel} value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} aria-label="Pays"><option value="">Tous les pays</option>{[...new Set(p.clinics.map((c) => c.country))].sort().map((c) => <option key={c}>{c}</option>)}</select>
        <select className={sel} value={f.language} onChange={(e) => setF({ ...f, language: e.target.value })} aria-label="Langue"><option value="">Toutes les langues</option><option value="fr">Français</option><option value="en">Anglais</option></select>
        <select className={sel} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} aria-label="Statut"><option value="">Tous les statuts</option><option value="actif">Actives</option><option value="prospect">Prospects</option><option value="suspendu">Suspendues</option></select>
        <select className={sel} value={f.maint} onChange={(e) => setF({ ...f, maint: e.target.value })} aria-label="Maintenance"><option value="">Toute maintenance</option>{Object.entries(MAINT_LABEL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
      </div>
      <div className="custom-scrollbar overflow-x-auto rounded-3xl border border-gray-200/70 bg-white shadow-cliva dark:border-gray-800 dark:bg-white/3">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-theme-xs text-gray-500 dark:bg-white/5"><tr>{["Clinique", "Pays · langue", "Licence", "Maintenance", "Usage du mois", ""].map((h, i) => <th key={i} className="px-4 py-2.5 text-start font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map((c) => {
              const m = maintenanceState(c, today, p.offer.graceDays);
              const u = usageOf(db, c, cur);
              const left = c.licencePrice - licencePaid(c);
              return (
                <tr key={c.id} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5" onClick={() => setOpen(c.id)}>
                  <td className="px-4 py-3"><span className="block font-medium text-gray-800 dark:text-white/90">{c.name}{c.isSelf && <span className="ms-1.5 rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">cette démo</span>}</span><span className="block text-theme-xs text-gray-500">{c.city} · {CLIENTELE_LABEL[c.clientele]} · {c.status === "actif" ? "active" : c.status}</span></td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{c.country}<span className="block text-theme-xs">{LANG_LABEL[c.language]}</span></td>
                  <td className="px-4 py-3 tabular-nums">{formatXOF(c.licencePrice)}<span className={cn("block text-theme-xs", left > 0 ? "text-warning-600" : "text-success-600")}>{c.status === "prospect" ? "à vendre" : left > 0 ? `reste ${formatXOF(left)}` : "soldée"}</span></td>
                  <td className="px-4 py-3"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", MAINT_LABEL[m.state].tone)}>{MAINT_LABEL[m.state].label}</span>{c.paidUntil && <span className="mt-0.5 block text-theme-xs text-gray-500">jusqu&apos;au {formatDate(c.paidUntil)}</span>}</td>
                  <td className="px-4 py-3 text-theme-xs text-gray-600 tabular-nums dark:text-gray-400">{u ? `${u.activeUsers} utilisateur(s) · ${u.consultations} consult. · ${u.sales} ventes` : "—"}</td>
                  <td className="px-4 py-3 text-end text-theme-xs font-medium text-brand-600">Ouvrir</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && <p className="px-5 py-10 text-center text-sm text-gray-500">Aucune clinique.</p>}
      </div>
      {current && <ClinicDetail c={current} onClose={() => setOpen(null)} onEdit={() => { setEdit({ ...current }); setOpen(null); }} />}
      <ClinicModal value={edit} onClose={() => setEdit(null)} />
    </div>
  );
}
