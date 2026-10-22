"use client";

import { AreaChart, BarChart, DonutChart } from "@/components/charts/AppCharts";
import ComponentCard from "@/components/common/ComponentCard";
import DemoNotice from "@/components/common/DemoNotice";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import StatCard from "@/components/common/StatCard";
import { TextField } from "@/components/form/Field";
import Select from "@/components/form/Select";
import DataTable from "@/components/tables/DataTable";
import Button from "@/components/ui/button/Button";
import Tabs from "@/components/ui/tabs/Tabs";
import { useDemo } from "@/context/DemoStoreContext";
import { useOptions } from "@/hooks/useOptions";
import { ActivityIcon, BedIcon, CalenderIcon, DownloadIcon, PawIcon, PrinterIcon, ReceiptIcon, StethoscopeIcon, TruckIcon, WalletIcon } from "@/icons";
import { productName } from "@/lib/calc";
import { addDays, daysBetween, formatDate, formatXOF } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/permissions";
import { activityByEstablishment, expensesByCategory, periodSummary, stockAlerts, userActivity, type Period } from "@/lib/services/reportsService";
import { exportCsv, printPage } from "@/utils/export";
import { useMemo, useState } from "react";

const PRESETS = [
  { value: "30", label: "30 derniers jours" },
  { value: "90", label: "90 derniers jours" },
  { value: "180", label: "6 derniers mois" },
  { value: "365", label: "12 derniers mois" },
  { value: "custom", label: "Personnalisée" },
];

export default function ReportsPage() {
  const { db, today, user, can } = useDemo();
  const opts = useOptions();
  const isDG = user?.roleId === "dg";
  const showFinance = can("finances") || can("facturation");
  const showClinical = can("consultations") || isDG || user?.roleId === "vet";
  const [preset, setPreset] = useState("90");
  const [from, setFrom] = useState(addDays(today, -90));
  const [to, setTo] = useState(today);
  const [est, setEst] = useState("");
  const [cat, setCat] = useState(showClinical ? "clinique" : "finances");
  const period: Period = useMemo(() => (preset === "custom" ? { from, to, establishmentId: est || undefined } : { from: addDays(today, -Number(preset)), to: today, establishmentId: est || undefined }), [preset, from, to, est, today]);
  const s = useMemo(() => periodSummary(db, period, isDG), [db, period, isDG]);
  const byEst = useMemo(() => activityByEstablishment(db, period), [db, period]);
  const exp = useMemo(() => expensesByCategory(db, period, isDG), [db, period, isDG]);
  const alerts = useMemo(() => stockAlerts(db, today, est || undefined), [db, today, est]);
  const users = useMemo(() => userActivity(db, period), [db, period]);
  const weekly = useMemo(() => {
    const n = Math.min(26, Math.max(4, Math.ceil(daysBetween(period.from, period.to) / 7)));
    const labels: string[] = [];
    const cons: number[] = [];
    const rev: number[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const end = addDays(period.to, -i * 7);
      const start = addDays(end, -6);
      labels.push(formatDate(start).slice(0, 5));
      cons.push(db.consultations.filter((c) => c.date.slice(0, 10) >= start && c.date.slice(0, 10) <= end && (!est || c.establishmentId === est)).length);
      rev.push(db.payments.filter((p) => p.date >= start && p.date <= end).reduce((t, p) => t + p.amount, 0));
    }
    return { labels, cons, rev };
  }, [db, period, est]);

  const exportSummary = () =>
    exportCsv(`cliva-rapport-${period.from}-${period.to}`, ["Indicateur", "Valeur"], [
      ["Période", `${formatDate(period.from)} → ${formatDate(period.to)}`],
      ["Établissement", est ? opts.establishments.find((e) => e.value === est)?.label : "Tous"],
      ["Consultations", s.consultations],
      ["Consultations validées", s.consultationsValidated],
      ["Patients suivis", s.patientsSeen],
      ["Rendez-vous", s.appointments],
      ["Rendez-vous honorés", s.honored],
      ["Rendez-vous annulés", s.cancelled],
      ["Absences", s.absent],
      ["Hospitalisations", s.hospitalizations],
      ["Journées d'hospitalisation", s.hospDays],
      ["Missions terrain", s.missions],
      ...(showFinance ? [["Chiffre d'affaires net (XOF)", s.revenue], ["Encaissements (XOF)", s.collected], ["Impayés (XOF)", s.unpaid], ["Dépenses (XOF)" + (isDG ? "" : " hors salaires"), s.expenses]] : []),
      ...(isDG ? [["Résultat (XOF, confidentiel)", s.result]] : []),
      ["Produits en stock faible", alerts.low.length],
      ["Lots proches de la péremption", alerts.expiring.length],
      ["Source", "Données fictives locales — démonstration"],
    ]);

  const tabs = [
    ...(showClinical ? [{ key: "clinique", label: "Activité clinique" }] : []),
    ...(showFinance ? [{ key: "finances", label: "Finances" }] : []),
    { key: "stock", label: "Stock" },
    { key: "etablissements", label: "Établissements" },
    ...(isDG ? [{ key: "utilisateurs", label: "Utilisateurs" }] : []),
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb
        pageTitle="Rapports et statistiques"
        subtitle={`${formatDate(period.from)} → ${formatDate(period.to)}`}
        actions={
          <>
            <Button size="sm" variant="outline" startIcon={<DownloadIcon />} onClick={exportSummary}>Export CSV</Button>
            <Button size="sm" variant="outline" startIcon={<PrinterIcon />} onClick={printPage}>Imprimer</Button>
          </>
        }
      />
      <DemoNotice>Statistiques recalculées à partir des données fictives de cette démonstration — elles ne proviennent d&apos;aucune base de données réelle.</DemoNotice>
      <div className="grid grid-cols-1 gap-2 rounded-2xl border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5 dark:border-gray-800 dark:bg-white/3 print:hidden">
        <Select value={preset} onChange={setPreset} options={PRESETS} />
        {preset === "custom" && (
          <>
            <TextField label="" type="date" value={from} onChange={setFrom} />
            <TextField label="" type="date" value={to} onChange={setTo} />
          </>
        )}
        <Select value={est} onChange={setEst} options={opts.establishments} placeholder="Tous les établissements" allowEmpty />
      </div>
      <Tabs tabs={tabs} active={cat} onChange={setCat} className="print:hidden" />

      {cat === "clinique" && (
        <>
          <div className="grid grid-cols-1 gap-3 2xsm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Consultations" value={s.consultations} hint={`${s.consultationsValidated} validées`} icon={<StethoscopeIcon />} />
            <StatCard label="Patients suivis" value={s.patientsSeen} icon={<PawIcon />} tone="secondary" />
            <StatCard label="RDV honorés / annulés" value={`${s.honored} / ${s.cancelled}`} hint={`${s.appointments} RDV · ${s.absent} absence(s) · taux ${s.appointments ? Math.round((s.honored / s.appointments) * 100) : 0} %`} icon={<CalenderIcon />} tone="tertiary" />
            <StatCard label="Hospitalisations" value={s.hospitalizations} hint={`${s.hospDays} journée(s)`} icon={<BedIcon />} tone="warning" />
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 xl:gap-6">
            <ComponentCard title="Consultations par semaine" className="xl:col-span-2">
              <BarChart labels={weekly.labels} series={[{ name: "Consultations", data: weekly.cons }]} height={260} />
            </ComponentCard>
            <ComponentCard title="Rendez-vous">
              <DonutChart labels={["Honorés", "Annulés", "Absents", "Autres"]} values={[s.honored, s.cancelled, s.absent, Math.max(0, s.appointments - s.honored - s.cancelled - s.absent)]} />
            </ComponentCard>
          </div>
          <ComponentCard title="Missions terrain">
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><p className="text-theme-xs text-gray-500">Missions</p><p className="text-lg font-semibold">{s.missions}</p></div>
              <div><p className="text-theme-xs text-gray-500">Terminées</p><p className="text-lg font-semibold">{s.missionsDone}</p></div>
              <div className="col-span-2 flex items-center gap-2 text-gray-500"><TruckIcon className="size-5" /> Interventions et consommations détaillées dans chaque mission.</div>
            </div>
          </ComponentCard>
        </>
      )}

      {cat === "finances" && showFinance && (
        <>
          <div className="grid grid-cols-1 gap-3 2xsm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Chiffre d'affaires net" value={formatXOF(s.revenue)} icon={<ReceiptIcon />} />
            <StatCard label="Encaissements" value={formatXOF(s.collected)} icon={<WalletIcon />} tone="tertiary" />
            <StatCard label="Impayés (à date)" value={formatXOF(s.unpaid)} icon={<ReceiptIcon />} tone="error" />
            <StatCard label={isDG ? "Résultat (confidentiel)" : "Dépenses hors salaires"} value={formatXOF(isDG ? s.result : s.expenses)} icon={<ActivityIcon />} tone={isDG && s.result < 0 ? "error" : "warning"} />
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 xl:gap-6">
            <ComponentCard title="Encaissements par semaine" className="xl:col-span-2">
              <AreaChart labels={weekly.labels} series={[{ name: "Encaissé", data: weekly.rev }]} currency height={260} />
            </ComponentCard>
            <ComponentCard title="Dépenses par catégorie">
              <DonutChart labels={exp.labels} values={exp.values} currency />
            </ComponentCard>
          </div>
        </>
      )}

      {cat === "stock" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
          <ComponentCard title={`Produits en stock faible (${alerts.low.length})`}>
            <DataTable rows={alerts.low} rowKey={(p) => p.id} pageSize={8} columns={[{ key: "n", header: "Article", primary: true, render: (p) => p.name }, { key: "t", header: "Seuil", align: "end", render: (p) => p.alertThreshold }]} emptyTitle="Aucun" />
          </ComponentCard>
          <ComponentCard title={`Lots proches de la péremption (${alerts.expiring.length})`}>
            <DataTable rows={alerts.expiring} rowKey={(l) => l.id} pageSize={8} columns={[{ key: "n", header: "Article / lot", primary: true, render: (l) => `${productName(db, l.productId)} — ${l.ref}` }, { key: "e", header: "Péremption", render: (l) => formatDate(l.expiryDate) }, { key: "q", header: "Qté", align: "end", render: (l) => l.qtyAvailable }]} emptyTitle="Aucun" />
          </ComponentCard>
        </div>
      )}

      {cat === "etablissements" && (
        <ComponentCard title="Performance par établissement">
          <BarChart labels={byEst.map((e) => e.name.replace("Cliva ", ""))} series={[{ name: "Consultations", data: byEst.map((e) => e.consultations) }, { name: "Rendez-vous", data: byEst.map((e) => e.appointments) }]} height={260} />
          <DataTable
            rows={byEst}
            rowKey={(e) => e.id}
            columns={[
              { key: "n", header: "Établissement", primary: true, render: (e) => e.name },
              { key: "c", header: "Consultations", align: "end", render: (e) => e.consultations },
              { key: "a", header: "RDV", align: "end", render: (e) => e.appointments },
              { key: "m", header: "Missions", align: "end", render: (e) => e.missions },
              ...(showFinance ? [{ key: "r", header: "CA net", align: "end" as const, render: (e: (typeof byEst)[number]) => formatXOF(e.revenue) }] : []),
            ]}
          />
        </ComponentCard>
      )}

      {cat === "utilisateurs" && isDG && (
        <ComponentCard title="Activité des utilisateurs" desc="Visible du seul profil DG">
          <DataTable
            rows={users}
            rowKey={(u) => u.user.id}
            columns={[
              { key: "n", header: "Utilisateur", primary: true, render: (u) => <span>{u.user.name} {!u.user.active && <span className="text-theme-xs text-gray-500">(désactivé)</span>}</span> },
              { key: "r", header: "Rôle", render: (u) => ROLE_LABELS[u.user.roleId] },
              { key: "a", header: "Actions journalisées", align: "end", render: (u) => u.actions },
              { key: "c", header: "Consultations (resp.)", align: "end", render: (u) => u.consultations },
              { key: "p", header: "Encaissements", align: "end", render: (u) => u.payments },
            ]}
          />
        </ComponentCard>
      )}
    </div>
  );
}
