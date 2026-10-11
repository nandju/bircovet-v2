"use client";

import { AreaChart, DonutChart } from "@/components/charts/AppCharts";
import ComponentCard from "@/components/common/ComponentCard";
import DemoNotice from "@/components/common/DemoNotice";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import StatCard from "@/components/common/StatCard";
import StatusBadge from "@/components/common/StatusBadge";
import DataTable from "@/components/tables/DataTable";
import { useDemo } from "@/context/DemoStoreContext";
import { Link } from "@/i18n/navigation";
import { LockIcon, ReceiptIcon, WalletIcon, DollarLineIcon } from "@/icons";
import { accountBalance, clientName, userName } from "@/lib/calc";
import { addDays, formatXOF } from "@/lib/format";
import { expensesByCategory, monthBuckets, periodSummary, revenueSeries } from "@/lib/services/reportsService";
import { useMemo } from "react";

export default function FinanceOverview() {
  const { db, today, user } = useDemo();
  const isDG = user?.roleId === "dg";
  const period = { from: today.slice(0, 7) + "-01", to: today };
  const s = useMemo(() => periodSummary(db, period, isDG), [db, isDG, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const rev = useMemo(() => revenueSeries(db, 6, today), [db, today]);
  const expSeries = useMemo(() => monthBuckets(6, today).map((b) => db.expenses.filter((e) => e.status === "approuvee" && e.date.startsWith(b.key) && (isDG || !e.confidential)).reduce((t, e) => t + e.amount, 0)), [db, today, isDG]);
  const exp = useMemo(() => expensesByCategory(db, { from: addDays(today, -90), to: today }, isDG), [db, today, isDG]);
  const pendingExpenses = db.expenses.filter((e) => e.status === "en_attente");
  const pendingCredits = db.credits.filter((c) => c.status === "en_attente");
  const treasury = db.accounts.reduce((t, a) => t + accountBalance(db, a.id), 0);

  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb pageTitle="Vue financière" subtitle="Montants en FCFA (XOF) — opérations simulées, aucun mouvement d'argent réel" />
      {!isDG && <DemoNotice>Les salaires et le résultat confidentiel sont réservés au profil DG. Les totaux affichés excluent les dépenses confidentielles.</DemoNotice>}
      <div className="grid grid-cols-1 gap-3 2xsm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Trésorerie totale (simulée)" value={formatXOF(treasury)} icon={<WalletIcon />} href="/finances/comptes" />
        <StatCard label="Encaissé ce mois" value={formatXOF(s.collected)} icon={<DollarLineIcon />} tone="tertiary" href="/finances/encaissements" />
        <StatCard label="Impayés clients" value={formatXOF(s.unpaid)} icon={<ReceiptIcon />} tone="error" href="/finances/creances" />
        {isDG ? <StatCard label="Résultat du mois (confidentiel)" value={formatXOF(s.result)} icon={<LockIcon />} tone={s.result >= 0 ? "brand" : "error"} hint="CA net − dépenses approuvées" /> : <StatCard label="Dépenses du mois (hors salaires)" value={formatXOF(s.expenses)} icon={<LockIcon />} tone="warning" />}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 xl:gap-6">
        <ComponentCard title="Recettes et dépenses" desc="6 derniers mois" className="xl:col-span-2">
          <AreaChart labels={rev.labels} currency series={[{ name: "Facturé net", data: rev.invoiced }, { name: "Encaissé", data: rev.collected }, { name: "Dépenses", data: expSeries }]} />
        </ComponentCard>
        <ComponentCard title="Dépenses par catégorie" desc="90 jours">
          <DonutChart labels={exp.labels} values={exp.values} currency />
        </ComponentCard>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <ComponentCard title="Soldes des comptes" actions={<Link href="/finances/comptes" className="text-theme-xs font-medium text-brand-600">Détail</Link>}>
          {db.accounts.map((a) => (
            <div key={a.id} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <StatusBadge kind="account" value={a.type} /> {a.name}
              </span>
              <strong>{formatXOF(accountBalance(db, a.id))}</strong>
            </div>
          ))}
        </ComponentCard>
        <ComponentCard title="Validations en attente (DG)">
          {pendingExpenses.length + pendingCredits.length === 0 ? (
            <p className="text-sm text-gray-500">Aucune demande en attente.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {pendingExpenses.map((e) => (
                <li key={e.id}>
                  <Link href="/finances/depenses" className="flex justify-between hover:underline">
                    <span>Dépense {e.code} — {e.label}</span>
                    <strong>{formatXOF(e.amount)}</strong>
                  </Link>
                </li>
              ))}
              {pendingCredits.map((c) => (
                <li key={c.id}>
                  <Link href="/finances/credits" className="flex justify-between hover:underline">
                    <span>Crédit {c.code} — {clientName(db, c.clientId)}</span>
                    <strong>{formatXOF(c.ceiling)}</strong>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </ComponentCard>
      </div>
      {isDG && (
        <ComponentCard title="Salaires (confidentiel — DG uniquement)" desc="Données fictives">
          <DataTable
            rows={db.salaries}
            rowKey={(x) => x.id}
            pageSize={6}
            initialSort={{ key: "m", dir: "desc" }}
            columns={[
              { key: "m", header: "Mois", primary: true, sortValue: (x) => x.month, render: (x) => x.month },
              { key: "u", header: "Collaborateur", render: (x) => userName(db, x.userId) },
              { key: "g", header: "Brut", align: "end", render: (x) => formatXOF(x.gross) },
              { key: "n", header: "Net", align: "end", render: (x) => formatXOF(x.net) },
            ]}
          />
        </ComponentCard>
      )}
    </div>
  );
}
