"use client";

import DemoNotice from "@/components/common/DemoNotice";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Tabs from "@/components/ui/tabs/Tabs";
import { useDemo } from "@/context/DemoStoreContext";
import { formatDateLong } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/permissions";
import { useState } from "react";
import { ConsultationsChartCard, EstablishmentActivityCard, ExpensesChartCard, RevenueChartCard, SalesMixChartCard, SpeciesChartCard } from "./DashboardCharts";
import DashboardKpis from "./DashboardKpis";
import { InvoicesToFollowCard, QuickActionsCard, RecentActivityCard, StockAlertsCard, TodayAgendaCard, UpcomingAppointmentsCard, UpcomingMissionsCard, UrgentTasksCard } from "./DashboardLists";
import NewsCard from "./NewsCard";
import PromoBanner from "./PromoBanner";
import SharedRecords from "./SharedRecords";
import { useDashboardData } from "./useDashboardData";

export default function Dashboard() {
  const { user, establishment, can, today } = useDemo();
  const [scope, setScope] = useState<"est" | "all">("all");
  const data = useDashboardData(scope === "est" ? establishment?.id : undefined);
  if (!user) return null;

  if (user.roleId === "confrere") return <SharedRecords />;

  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb
        pageTitle={`Bonjour, ${user.name.split(" ").slice(0, 2).join(" ")}`}
        subtitle={`${formatDateLong(today)} · ${ROLE_LABELS[user.roleId]}`}
        actions={
          <Tabs
            tabs={[
              { key: "all", label: "Tous les établissements" },
              { key: "est", label: establishment?.city ?? "Établissement actif" },
            ]}
            active={scope}
            onChange={(k) => setScope(k as "est" | "all")}
          />
        }
      />
      <DemoNotice>Indicateurs calculés à partir des données fictives enregistrées dans ce navigateur. Ils évoluent après chaque opération simulée (encaissement, consultation, délivrance…).</DemoNotice>
      <DashboardKpis data={data} />
      <PromoBanner />
      <QuickActionsCard />

      <div className="grid grid-cols-12 gap-4 md:gap-6">
        {can("facturation") && (
          <div className="col-span-12 xl:col-span-8">
            <RevenueChartCard est={scope === "est" ? establishment?.id : undefined} />
          </div>
        )}
        {can("agenda") && (
          <div className="col-span-12 xl:col-span-4">
            <TodayAgendaCard appts={data.todayAppts} />
          </div>
        )}
        {can("consultations") && (
          <div className="col-span-12 lg:col-span-6 xl:col-span-4">
            <ConsultationsChartCard est={scope === "est" ? establishment?.id : undefined} />
          </div>
        )}
        {can("patients") && (
          <div className="col-span-12 lg:col-span-6 xl:col-span-4">
            <SpeciesChartCard />
          </div>
        )}
        {can("rapports") || can("consultations") ? (
          <div className="col-span-12 lg:col-span-6 xl:col-span-4">
            <EstablishmentActivityCard />
          </div>
        ) : null}
        {can("finances") && (
          <div className="col-span-12 lg:col-span-6 xl:col-span-5">
            <ExpensesChartCard est={scope === "est" ? establishment?.id : undefined} />
          </div>
        )}
        {can("facturation") && (
          <div className="col-span-12 xl:col-span-7">
            <SalesMixChartCard />
          </div>
        )}
        {can("agenda") && (
          <div className="col-span-12 md:col-span-6 xl:col-span-4">
            <UpcomingAppointmentsCard />
          </div>
        )}
        {can("stock") && (
          <div className="col-span-12 md:col-span-6 xl:col-span-4">
            <StockAlertsCard low={data.alerts.low} expiring={data.alerts.expiring} expired={data.alerts.expired} />
          </div>
        )}
        {can("facturation") && (
          <div className="col-span-12 md:col-span-6 xl:col-span-4">
            <InvoicesToFollowCard unpaid={data.unpaid} />
          </div>
        )}
        {can("relation") && (
          <div className="col-span-12 md:col-span-6 xl:col-span-4">
            <UrgentTasksCard />
          </div>
        )}
        {can("missions") && (
          <div className="col-span-12 md:col-span-6 xl:col-span-4">
            <UpcomingMissionsCard />
          </div>
        )}
        <div className="col-span-12 md:col-span-6 xl:col-span-4">
          <RecentActivityCard />
        </div>
        <div className="col-span-12 md:col-span-6 xl:col-span-4">
          <NewsCard />
        </div>
      </div>
    </div>
  );
}
