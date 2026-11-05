"use client";

import StatCard from "@/components/common/StatCard";
import { useDemo } from "@/context/DemoStoreContext";
import { Link } from "@/i18n/navigation";
import { CalenderIcon, DollarLineIcon, StethoscopeIcon, WalletIcon } from "@/icons";
import { formatNumber, formatXOF } from "@/lib/format";
import type { ModuleId } from "@/lib/permissions";
import type { useDashboardData } from "./useDashboardData";

type Data = ReturnType<typeof useDashboardData>;

/** Activité sur 30 jours glissants (4 indicateurs) + rappel de la base suivie. */
export default function DashboardKpis({ data }: { data: Data }) {
  const { can } = useDemo();
  const cards: { module: ModuleId; node: React.ReactNode; key: string }[] = [
    { key: "ca", module: "facturation", node: <StatCard label="Chiffre d'affaires" value={formatXOF(data.revenue)} icon={<DollarLineIcon />} delta={{ value: data.revenueDelta, label: "vs 30 j précédents" }} href="/rapports" featured="gestion" /> },
    { key: "enc", module: "finances", node: <StatCard label="Paiements reçus" value={formatXOF(data.collected)} icon={<WalletIcon />} tone="tertiary" delta={{ value: data.collectedDelta, label: "vs 30 j précédents" }} href="/finances/encaissements" /> },
    { key: "cons", module: "consultations", node: <StatCard label="Consultations" value={formatNumber(data.consultations30)} icon={<StethoscopeIcon />} tone="secondary" delta={{ value: data.consultationsDelta, label: "vs 30 j précédents" }} href="/consultations" /> },
    { key: "rdv", module: "agenda", node: <StatCard label="Rendez-vous du jour" value={data.todayAppointments} icon={<CalenderIcon />} tone="tertiary" hint={`${data.waiting} en salle d'attente`} href="/agenda" /> },
  ];
  const visible = cards.filter((c) => can(c.module));

  const base: { module: ModuleId; href: string; label: string; value: string }[] = [
    { module: "clients", href: "/clients", label: "clients actifs", value: `${formatNumber(data.clients)}${data.newClients30 ? ` (+${data.newClients30} en 30 j)` : ""}` },
    { module: "patients", href: "/patients", label: "patients suivis", value: formatNumber(data.patients) },
    { module: "missions", href: "/missions", label: "missions terrain programmées", value: formatNumber(data.missionsPlanned) },
  ];
  const baseVisible = base.filter((b) => can(b.module));

  if (!visible.length && !baseVisible.length) return null;
  return (
    <section aria-labelledby="kpi-title" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="kpi-title" className="text-base font-semibold text-gray-800 dark:text-white/90">
          Activité <span className="font-normal text-gray-500 dark:text-gray-400">· 30 derniers jours</span>
        </h2>
        {baseVisible.length > 0 && (
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-theme-xs text-gray-500 dark:text-gray-400">
            {baseVisible.map((b) => (
              <Link key={b.href} href={b.href} className="hover:text-brand-600 dark:hover:text-brand-400">
                <span className="font-semibold text-gray-700 tabular-nums dark:text-gray-200">{b.value}</span> {b.label}
              </Link>
            ))}
          </p>
        )}
      </div>
      {visible.length > 0 && (
        <div className="grid grid-cols-1 gap-3 2xsm:grid-cols-2 md:gap-4 xl:grid-cols-4">
          {visible.map((c) => (
            <div key={c.key}>{c.node}</div>
          ))}
        </div>
      )}
    </section>
  );
}
