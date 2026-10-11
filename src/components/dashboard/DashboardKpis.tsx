"use client";

import StatCard from "@/components/common/StatCard";
import { useDemo } from "@/context/DemoStoreContext";
import { AlertTriangleIcon, BedIcon, CalenderIcon, LayersIcon, PawIcon, ReceiptIcon, StethoscopeIcon, TaskIcon, TruckIcon, UsersIcon, WalletIcon, DollarLineIcon } from "@/icons";
import { formatNumber, formatXOF } from "@/lib/format";
import type { ModuleId } from "@/lib/permissions";
import type { useDashboardData } from "./useDashboardData";

type Data = ReturnType<typeof useDashboardData>;

export default function DashboardKpis({ data }: { data: Data }) {
  const { can } = useDemo();
  const cards: { module: ModuleId; node: React.ReactNode; key: string }[] = [
    { key: "clients", module: "clients", node: <StatCard label="Clients actifs" value={formatNumber(data.clients)} icon={<UsersIcon />} hint={`+${data.newClients30} sur 30 jours`} href="/clients" /> },
    { key: "patients", module: "patients", node: <StatCard label="Patients suivis" value={formatNumber(data.patients)} icon={<PawIcon />} tone="secondary" hint="Animaux vivants enregistrés" href="/patients" /> },
    { key: "rdv", module: "agenda", node: <StatCard label="Rendez-vous du jour" value={data.todayAppointments} icon={<CalenderIcon />} tone="tertiary" hint={`${data.waiting} patient(s) en salle d'attente`} href="/agenda/file-attente" /> },
    { key: "cons", module: "consultations", node: <StatCard label="Consultations en cours" value={data.inConsultation} icon={<StethoscopeIcon />} delta={{ value: data.consultationsDelta, label: `${data.consultationsMonth} ce mois vs mois précédent` }} href="/consultations" /> },
    { key: "hosp", module: "hospitalisation", node: <StatCard label="Patients hospitalisés" value={data.hospitalized} icon={<BedIcon />} tone="warning" hint="Séjours en cours" href="/hospitalisation" /> },
    { key: "ca", module: "facturation", node: <StatCard label="Chiffre d'affaires du mois (démo)" value={formatXOF(data.revenue)} icon={<DollarLineIcon />} delta={{ value: data.revenueDelta, label: "vs mois précédent" }} href="/rapports" /> },
    { key: "enc", module: "finances", node: <StatCard label="Paiements reçus du mois" value={formatXOF(data.collected)} icon={<WalletIcon />} tone="tertiary" delta={{ value: data.collectedDelta, label: "vs mois précédent" }} href="/finances/encaissements" /> },
    { key: "imp", module: "facturation", node: <StatCard label="Factures impayées" value={data.unpaidCount} icon={<ReceiptIcon />} tone="error" hint={`Solde ${formatXOF(data.unpaidAmount)}`} href="/facturation" /> },
    { key: "low", module: "stock", node: <StatCard label="Produits en stock faible" value={data.lowStock} icon={<AlertTriangleIcon />} tone="warning" hint="Sous le seuil d'alerte" href="/stock/alertes" /> },
    { key: "exp", module: "stock", node: <StatCard label="Lots proches de la péremption" value={data.expiring} icon={<LayersIcon />} tone="warning" hint="Dans l'horizon d'alerte paramétré" href="/stock/alertes" /> },
    { key: "tasks", module: "relation", node: <StatCard label="Tâches en retard" value={data.overdueTasks} icon={<TaskIcon />} tone="error" hint="Échéance dépassée" href="/relation-client" /> },
    { key: "mis", module: "missions", node: <StatCard label="Missions terrain programmées" value={data.missionsPlanned} icon={<TruckIcon />} tone="secondary" hint="Planifiées ou en cours" href="/missions" /> },
  ];
  const visible = cards.filter((c) => can(c.module));
  return (
    <div className="grid grid-cols-1 gap-3 2xsm:grid-cols-2 md:gap-4 lg:grid-cols-3 2xl:grid-cols-4">
      {visible.map((c) => (
        <div key={c.key}>{c.node}</div>
      ))}
    </div>
  );
}
