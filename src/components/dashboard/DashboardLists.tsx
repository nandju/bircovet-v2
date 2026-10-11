"use client";

import ComponentCard from "@/components/common/ComponentCard";
import EmptyState from "@/components/common/EmptyState";
import StatusBadge from "@/components/common/StatusBadge";
import { useDemo } from "@/context/DemoStoreContext";
import { Link } from "@/i18n/navigation";
import { BedIcon, CalenderIcon, CartIcon, PawIcon, ReceiptIcon, StethoscopeIcon, UsersIcon, WalletIcon } from "@/icons";
import { clientName, invoiceBalance, patientName, productName, userName } from "@/lib/calc";
import { daysBetween, formatDate, formatDateTime, formatTime, formatXOF } from "@/lib/format";
import type { ModuleId } from "@/lib/permissions";
import type { Appointment, Invoice, StockLot } from "@/lib/types";
import { cn } from "@/utils";

const seeAll = (href: string) => (
  <Link href={href} className="text-theme-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
    Tout voir
  </Link>
);

const Row = ({ href, title, sub, right }: { href: string; title: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode }) => (
  <li>
    <Link href={href} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-gray-50 dark:hover:bg-white/3">
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-gray-800 dark:text-white/90">{title}</span>
        {sub && <span className="block truncate text-theme-xs text-gray-500 dark:text-gray-400">{sub}</span>}
      </span>
      {right && <span className="shrink-0">{right}</span>}
    </Link>
  </li>
);

export function TodayAgendaCard({ appts }: { appts: Appointment[] }) {
  const { db } = useDemo();
  const list = [...appts].sort((a, b) => a.start.localeCompare(b.start));
  return (
    <ComponentCard title="Agenda du jour et file d'attente" actions={seeAll("/agenda/file-attente")} bodyClassName="p-2 sm:p-3">
      {list.length === 0 ? (
        <EmptyState title="Aucun rendez-vous aujourd'hui" />
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {list.slice(0, 8).map((a) => (
            <Row
              key={a.id}
              href="/agenda/file-attente"
              title={
                <>
                  <span className="me-2 font-mono text-theme-xs text-tertiary-600 dark:text-tertiary-400">{formatTime(a.start)}</span>
                  {patientName(db, a.patientId)} · {clientName(db, a.clientId)}
                </>
              }
              sub={`${a.reason} — ${userName(db, a.practitionerId)}`}
              right={<StatusBadge kind="queue" value={a.queueStatus} />}
            />
          ))}
        </ul>
      )}
    </ComponentCard>
  );
}

export function UpcomingAppointmentsCard() {
  const { db, today } = useDemo();
  const list = db.appointments.filter((a) => a.start.slice(0, 10) > today && a.status !== "annule").sort((a, b) => a.start.localeCompare(b.start)).slice(0, 6);
  return (
    <ComponentCard title="Prochains rendez-vous" actions={seeAll("/agenda")} bodyClassName="p-2 sm:p-3">
      {list.length === 0 ? (
        <EmptyState title="Aucun rendez-vous à venir" />
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {list.map((a) => (
            <Row key={a.id} href="/agenda" title={`${patientName(db, a.patientId)} — ${a.reason}`} sub={`${formatDateTime(a.start)} · ${userName(db, a.practitionerId)}`} right={<StatusBadge kind="appointment" value={a.status} />} />
          ))}
        </ul>
      )}
    </ComponentCard>
  );
}

export function StockAlertsCard({ low, expiring, expired }: { low: { id: string; name: string }[]; expiring: StockLot[]; expired: StockLot[] }) {
  const { db, today } = useDemo();
  return (
    <ComponentCard title="Alertes de stock" actions={seeAll("/stock/alertes")} bodyClassName="p-2 sm:p-3">
      {low.length + expiring.length + expired.length === 0 ? (
        <EmptyState title="Aucune alerte de stock" />
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {low.slice(0, 3).map((p) => (
            <Row key={p.id} href={`/stock/articles/${p.id}`} title={p.name} sub="Stock sous le seuil d'alerte" right={<span className="rounded-full bg-warning-50 px-2 py-0.5 text-theme-xs font-medium text-warning-700 dark:bg-warning-500/15 dark:text-warning-400">Stock faible</span>} />
          ))}
          {expiring.slice(0, 3).map((l) => (
            <Row key={l.id} href="/stock/lots" title={`${productName(db, l.productId)} — ${l.ref}`} sub={`Péremption ${formatDate(l.expiryDate)} (${daysBetween(today, l.expiryDate)} j)`} right={<StatusBadge kind="lot" value="reserve" />} />
          ))}
          {expired.slice(0, 2).map((l) => (
            <Row key={l.id} href="/stock/lots" title={`${productName(db, l.productId)} — ${l.ref}`} sub={`${l.qtyAvailable} unité(s) bloquée(s)`} right={<StatusBadge kind="lot" value="perime" />} />
          ))}
        </ul>
      )}
    </ComponentCard>
  );
}

export function InvoicesToFollowCard({ unpaid }: { unpaid: Invoice[] }) {
  const { db } = useDemo();
  const list = [...unpaid].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 6);
  return (
    <ComponentCard title="Factures à suivre" actions={seeAll("/facturation")} bodyClassName="p-2 sm:p-3">
      {list.length === 0 ? (
        <EmptyState title="Aucune facture impayée" />
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {list.map((i) => (
            <Row key={i.id} href={`/facturation/factures/${i.id}`} title={`${i.code} — ${clientName(db, i.clientId)}`} sub={`Échéance ${formatDate(i.dueDate)} · solde ${formatXOF(invoiceBalance(db, i))}`} right={<StatusBadge kind="invoice" value={i.status} />} />
          ))}
        </ul>
      )}
    </ComponentCard>
  );
}

export function UrgentTasksCard() {
  const { db, today } = useDemo();
  const list = db.tasks
    .filter((t) => t.status !== "termine" && (t.dueDate <= today || t.priority === "urgente" || t.priority === "haute"))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 6);
  return (
    <ComponentCard title="Tâches urgentes" actions={seeAll("/relation-client")} bodyClassName="p-2 sm:p-3">
      {list.length === 0 ? (
        <EmptyState title="Aucune tâche urgente" />
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {list.map((t) => (
            <Row key={t.id} href="/relation-client" title={t.title} sub={<span className={cn(t.dueDate < today && "font-medium text-error-600 dark:text-error-400")}>Échéance {formatDate(t.dueDate)} · {userName(db, t.assigneeId)}</span>} right={<StatusBadge kind="priority" value={t.priority} />} />
          ))}
        </ul>
      )}
    </ComponentCard>
  );
}

export function UpcomingMissionsCard() {
  const { db, today } = useDemo();
  const list = db.missions.filter((m) => m.date >= today && m.status !== "annulee" && m.status !== "terminee").sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  return (
    <ComponentCard title="Missions terrain à venir" actions={seeAll("/missions")} bodyClassName="p-2 sm:p-3">
      {list.length === 0 ? (
        <EmptyState title="Aucune mission programmée" />
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {list.map((m) => (
            <Row key={m.id} href={`/missions/${m.id}`} title={`${m.code} — ${m.objective}`} sub={`${formatDate(m.date)} · ${m.location}`} right={<StatusBadge kind="mission" value={m.status} />} />
          ))}
        </ul>
      )}
    </ComponentCard>
  );
}

export function RecentActivityCard() {
  const { db, can } = useDemo();
  return (
    <ComponentCard title="Activités récentes" actions={can("admin") ? seeAll("/administration/journal") : undefined} bodyClassName="p-2 sm:p-3">
      <ul className="space-y-1">
        {db.audit.slice(0, 7).map((a) => (
          <li key={a.id} className="flex gap-3 rounded-lg px-2 py-2">
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-500" />
            <span className="min-w-0">
              <span className="block truncate text-sm text-gray-800 dark:text-white/90">
                {a.action} — <span className="text-gray-500 dark:text-gray-400">{a.target}</span>
              </span>
              <span className="block text-theme-xs text-gray-500 dark:text-gray-400">
                {userName(db, a.userId)} · {a.module} · {formatDateTime(a.date)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </ComponentCard>
  );
}

const ACTIONS: { label: string; href: string; module: ModuleId; icon: React.ReactNode }[] = [
  { label: "Nouveau rendez-vous", href: "/agenda?nouveau=1", module: "agenda", icon: <CalenderIcon /> },
  { label: "Nouveau client", href: "/clients/nouveau", module: "clients", icon: <UsersIcon /> },
  { label: "Nouveau patient", href: "/patients?nouveau=1", module: "patients", icon: <PawIcon /> },
  { label: "Consultation", href: "/consultations/nouvelle", module: "consultations", icon: <StethoscopeIcon /> },
  { label: "Admission", href: "/hospitalisation?nouveau=1", module: "hospitalisation", icon: <BedIcon /> },
  { label: "Encaissement", href: "/finances/encaissements?nouveau=1", module: "finances", icon: <WalletIcon /> },
  { label: "Devis", href: "/facturation/devis?nouveau=1", module: "facturation", icon: <ReceiptIcon /> },
  { label: "Commande", href: "/achats?nouveau=1", module: "achats", icon: <CartIcon /> },
];

export function QuickActionsCard() {
  const { can } = useDemo();
  const items = ACTIONS.filter((a) => can(a.module, "create"));
  if (!items.length) return null;
  return (
    <ComponentCard title="Actions rapides">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map((a) => (
          <Link key={a.href} href={a.href} className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 px-2 py-3 text-center text-theme-xs font-medium text-gray-700 transition hover:border-brand-300 hover:bg-brand-25 hover:text-brand-700 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-white/5 [&_svg]:size-5">
            <span className="text-brand-500">{a.icon}</span>
            {a.label}
          </Link>
        ))}
      </div>
    </ComponentCard>
  );
}
