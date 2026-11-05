"use client";

import ActivityIcon from "@/components/common/ActivityIcon";
import TreatmentsSummary from "@/components/treatments/TreatmentsSummary";
import StaffSummaryCard from "@/components/staff/StaffSummaryCard";
import { CounterSalesToday, ReceiptsCard, StockOutCard } from "./DailyFigures";
import PayablesCard from "@/components/payables/PayablesCard";
import { MarginsCard } from "@/components/margins/MarginsParts";
import { DailyReportsCard, PendingApprovalsCard } from "@/components/missions/DailyReportsCard";
import { useNow } from "@/hooks/useNow";
import ComponentCard from "@/components/common/ComponentCard";
import EmptyState from "@/components/common/EmptyState";
import StatCard from "@/components/common/StatCard";
import { useDemo } from "@/context/DemoStoreContext";
import { Link } from "@/i18n/navigation";
import { BedIcon, BoltIcon, CalenderIcon, ChatIcon, FarmIcon, PawIcon, PlusIcon, StethoscopeIcon, TaskIcon, TruckIcon, UsersIcon } from "@/icons";
import { RENTE_SPECIES } from "@/lib/followup";
import { addDays, formatDate, formatNumber } from "@/lib/format";
import type { ModuleId } from "@/lib/permissions";
import { cn } from "@/utils";
import ActionCenter from "./ActionCenter";
import { ConsultationsChartCard, ExpensesChartCard, RevenueChartCard, SalesMixChartCard, SpeciesChartCard } from "./DashboardCharts";
import DashboardKpis from "./DashboardKpis";
import { InvoicesToFollowCard, StockAlertsCard, TodayAgendaCard, UpcomingAppointmentsCard, UpcomingMissionsCard } from "./DashboardLists";
import type { useDashboardData } from "./useDashboardData";

type Data = ReturnType<typeof useDashboardData>;

/** Raccourcis propres à une activité (3 à 4 boutons, pas plus). */
function Shortcuts({ items }: { items: { label: string; href: string; module: ModuleId; icon: React.ReactNode; primary?: boolean }[] }) {
  const { can } = useDemo();
  const visible = items.filter((i) => can(i.module, "create"));
  if (!visible.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {visible.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className={cn(
            "cliva-press inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition [&_svg]:size-4",
            a.primary ? "bg-linear-to-br from-brand-500 to-brand-600 text-white shadow-theme-sm hover:from-brand-600 hover:to-brand-700" : "border border-gray-200/70 bg-white text-gray-700 shadow-cliva hover:border-brand-300 hover:text-brand-700 dark:border-gray-800 dark:bg-white/3 dark:text-gray-300",
          )}
        >
          {a.icon}
          {a.label}
        </Link>
      ))}
    </div>
  );
}

function useTouchesDone(context: "compagnie" | "rente") {
  const { db, today } = useDemo();
  const from = addDays(today, -29);
  return (db.followUps ?? []).filter((p) => p.context === context).reduce((n, p) => n + p.touches.filter((t) => t.status === "fait" && (t.doneAt ?? "").slice(0, 10) >= from).length, 0);
}

/* ---------------- Clinique · animaux de compagnie ---------------- */

export function ClinicView({ data }: { data: Data }) {
  const { db, today, can } = useDemo();
  const from = addDays(today, -29);
  const isPet = (patientId: string) => !RENTE_SPECIES.includes(db.patients.find((p) => p.id === patientId)?.species ?? "");
  const cons30 = db.consultations.filter((c) => c.date.slice(0, 10) >= from && isPet(c.patientId)).length;
  const pets = db.patients.filter((p) => p.vitalStatus === "vivant" && !p.archived && !RENTE_SPECIES.includes(p.species)).length;
  const touches = useTouchesDone("compagnie");
  const now = useNow();
  return (
    <div className="space-y-4 md:space-y-6">
      <Shortcuts
        items={[
          { label: "Nouveau rendez-vous", href: "/agenda?nouveau=1", module: "agenda", icon: <CalenderIcon />, primary: true },
          { label: "Consultation", href: "/consultations/nouvelle", module: "consultations", icon: <StethoscopeIcon /> },
          { label: "Nouveau patient", href: "/patients?nouveau=1", module: "patients", icon: <PawIcon /> },
          { label: "Admission", href: "/hospitalisation?nouveau=1", module: "hospitalisation", icon: <BedIcon /> },
          { label: "Visite à domicile", href: "/consultations/domicile", module: "consultations", icon: <ActivityIcon kind="domicile" className="size-5 text-current" /> },
        ]}
      />
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className={can("agenda") ? "col-span-12 xl:col-span-7" : "col-span-12"}>
          <ActionCenter data={data} scope="clinique" stacked={can("agenda")} />
        </div>
        {can("agenda") && (
          <div className="col-span-12 xl:col-span-5">
            <TodayAgendaCard appts={data.todayAppts} />
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 2xsm:grid-cols-2 md:gap-4 xl:grid-cols-4">
        {can("consultations") && <StatCard label="Consultations · 30 j" value={formatNumber(cons30)} icon={<StethoscopeIcon />} href="/consultations" featured="brand" />}
        {can("agenda") && <StatCard label="Rendez-vous du jour" value={data.todayAppointments} icon={<CalenderIcon />} tone="tertiary" hint={`${data.waiting} en salle d'attente`} href="/agenda" />}
        {can("patients") && <StatCard label="Animaux suivis" value={formatNumber(pets)} icon={<PawIcon />} tone="secondary" hint="chiens, chats, NAC" href="/patients" />}
        {can("relation") && <StatCard label="Clients relancés · 30 j" value={formatNumber(touches)} icon={<ChatIcon />} tone="tertiary" hint="contacts de suivi enregistrés" href="/relation-client/suivi" />}
      </div>
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        {can("hospitalisation") && (
          <section className="col-span-12 rounded-3xl border border-gray-200/70 bg-white shadow-cliva p-4 dark:border-gray-800 dark:bg-white/3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Suivi des traitements</h3>
              <Link href="/traitements" className="text-theme-xs font-medium text-brand-600 hover:underline dark:text-brand-400">Tout voir</Link>
            </div>
            <TreatmentsSummary now={now} />
          </section>
        )}
      </div>
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        {can("agenda") && (
          <div className="col-span-12 lg:col-span-6">
            <UpcomingAppointmentsCard />
          </div>
        )}
        {can("consultations") && (
          <div className="col-span-12 lg:col-span-6">
            <ConsultationsChartCard />
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Rural · animaux de rente ---------------- */

function FarmActionsCard() {
  const { db, today } = useDemo();
  const list = db.missions
    .flatMap((m) => m.actionItems.filter((a) => !a.done).map((a) => ({ m, a })))
    .sort((x, y) => (x.a.dueDate ?? "9").localeCompare(y.a.dueDate ?? "9"))
    .slice(0, 7);
  return (
    <ComponentCard title="Actions à mener en élevage" actions={<Link href="/missions" className="text-theme-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">Tout voir</Link>} bodyClassName="p-2 sm:p-3">
      {list.length === 0 ? (
        <EmptyState title="Aucune action en attente" />
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {list.map(({ m, a }) => {
            const late = a.dueDate && a.dueDate < today;
            return (
              <li key={a.id}>
                <Link href={`/missions/${m.id}`} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-gray-50 dark:hover:bg-white/3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-gray-800 dark:text-white/90">{a.label}</span>
                    <span className="block truncate text-theme-xs text-gray-500 dark:text-gray-400">
                      {m.location} · {db.users.find((u) => u.id === a.assigneeId)?.name ?? "non attribuée"}
                    </span>
                  </span>
                  <span className={cn("shrink-0 text-theme-xs tabular-nums", late ? "font-medium text-error-600 dark:text-error-400" : "text-gray-500")}>{a.dueDate ? formatDate(a.dueDate) : "—"}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </ComponentCard>
  );
}

export function RuralView({ data }: { data: Data }) {
  const { db, today, can } = useDemo();
  const from = addDays(today, -29);
  const missions30 = db.missions.filter((m) => m.status === "terminee" && m.date.slice(0, 10) >= from).length;
  const activeFarms = db.farms.filter((f) => f.status === "actif").length;
  const touches = useTouchesDone("rente");
  return (
    <div className="space-y-4 md:space-y-6">
      <Shortcuts
        items={[
          { label: "Visite de ferme", href: "/missions?nouveau=visite", module: "missions", icon: <FarmIcon />, primary: true },
          { label: "Urgence rurale", href: "/missions?nouveau=urgence", module: "missions", icon: <BoltIcon /> },
          { label: "Mission terrain", href: "/missions?nouveau=1", module: "missions", icon: <TruckIcon /> },
          { label: "Nouvelle exploitation", href: "/exploitations?nouveau=1", module: "exploitations", icon: <PlusIcon /> },
        ]}
      />
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12 lg:col-span-7">
          <DailyReportsCard />
        </div>
        <div className="col-span-12 lg:col-span-5">
          <PendingApprovalsCard />
        </div>
      </div>
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12 xl:col-span-7">
          <ActionCenter data={data} scope="rural" stacked />
        </div>
        <div className="col-span-12 xl:col-span-5">
          <UpcomingMissionsCard />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 2xsm:grid-cols-2 md:gap-4 xl:grid-cols-4">
        {can("missions") && <StatCard label="Missions réalisées · 30 j" value={formatNumber(missions30)} icon={<TruckIcon />} tone="secondary" href="/missions" featured="rural" />}
        {can("missions") && <StatCard label="Missions programmées" value={formatNumber(data.missionsPlanned)} icon={<CalenderIcon />} tone="tertiary" hint="planifiées ou en cours" href="/missions" />}
        {can("exploitations") && <StatCard label="Exploitations suivies" value={formatNumber(activeFarms)} icon={<FarmIcon />} href="/exploitations" />}
        {can("relation") && <StatCard label="Éleveurs relancés · 30 j" value={formatNumber(touches)} icon={<ChatIcon />} tone="tertiary" hint="contacts de suivi enregistrés" href="/relation-client/suivi" />}
      </div>
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12 lg:col-span-7">
          <FarmActionsCard />
        </div>
        <div className="col-span-12 lg:col-span-5">
          <SpeciesChartCard />
        </div>
      </div>
    </div>
  );
}

/* ---------------- Gestion : argent et stock ---------------- */

export function GestionView({ data, est }: { data: Data; est?: string }) {
  const { can } = useDemo();
  return (
    <div className="space-y-4 md:space-y-6">
      <Shortcuts
        items={[
          { label: "Encaissement", href: "/finances/encaissements?nouveau=1", module: "finances", icon: <PlusIcon />, primary: true },
          { label: "Devis", href: "/facturation/devis?nouveau=1", module: "facturation", icon: <TaskIcon /> },
          { label: "Commande fournisseur", href: "/achats?nouveau=1", module: "achats", icon: <TruckIcon /> },
          { label: "Nouveau client", href: "/clients/nouveau", module: "clients", icon: <UsersIcon /> },
        ]}
      />
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        {(can("finances") || can("facturation")) && (
          <div className="col-span-12 lg:col-span-7">
            <ReceiptsCard est={est} />
          </div>
        )}
        {can("stock") && (
          <div className="col-span-12 lg:col-span-5">
            <StockOutCard est={est} />
          </div>
        )}
        {(can("stock") || can("facturation")) && (
          <div className="col-span-12 lg:col-span-6">
            <CounterSalesToday est={est} compact />
          </div>
        )}
        {(can("achats") || can("finances")) && (
          <div className="col-span-12 lg:col-span-6">
            <PayablesCard est={est} />
          </div>
        )}
        {(can("finances") || can("facturation")) && (
          <div className="col-span-12 lg:col-span-6">
            <MarginsCard est={est} />
          </div>
        )}
      </div>
      <ActionCenter data={data} scope="gestion" />
      <DashboardKpis data={data} />
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        {can("facturation") && (
          <div className="col-span-12">
            <RevenueChartCard est={est} />
          </div>
        )}
        {can("facturation") && (
          <div className="col-span-12 md:col-span-6">
            <InvoicesToFollowCard unpaid={data.unpaid} />
          </div>
        )}
        {can("stock") && (
          <div className="col-span-12 md:col-span-6">
            <StockAlertsCard low={data.alerts.low} expiring={data.alerts.expiring} expired={data.alerts.expired} />
          </div>
        )}
        {can("finances") && (
          <div className="col-span-12 lg:col-span-5">
            <ExpensesChartCard est={est} />
          </div>
        )}
        {can("facturation") && (
          <div className="col-span-12 lg:col-span-7">
            <SalesMixChartCard />
          </div>
        )}
        <div className="col-span-12 lg:col-span-6">
          <StaffSummaryCard />
        </div>
      </div>
    </div>
  );
}
