"use client";

import { AreaChart, BarChart, DonutChart } from "@/components/charts/AppCharts";
import ComponentCard from "@/components/common/ComponentCard";
import Select from "@/components/form/Select";
import { useDemo } from "@/context/DemoStoreContext";
import { addDays } from "@/lib/format";
import { activityByEstablishment, consultationSeries, expensesByCategory, revenueSeries, salesMix, speciesDistribution } from "@/lib/services/reportsService";
import { useMemo, useState } from "react";

const PeriodSelect = ({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) => (
  <div className="w-36">
    <Select value={value} onChange={onChange} options={options} className="h-9 py-1.5 text-xs" />
  </div>
);

export function RevenueChartCard({ est }: { est?: string }) {
  const { db, today } = useDemo();
  const [months, setMonths] = useState("6");
  const s = useMemo(() => revenueSeries(db, Number(months), today, est), [db, months, today, est]);
  return (
    <ComponentCard title="Évolution des recettes" desc="Facturé net (avoirs déduits) et encaissé — données fictives" actions={<PeriodSelect value={months} onChange={setMonths} options={[{ value: "3", label: "3 mois" }, { value: "6", label: "6 mois" }, { value: "12", label: "12 mois" }]} />}>
      <AreaChart labels={s.labels} currency series={[{ name: "Facturé", data: s.invoiced }, { name: "Encaissé", data: s.collected }]} />
    </ComponentCard>
  );
}

export function ConsultationsChartCard({ est }: { est?: string }) {
  const { db, today } = useDemo();
  const [g, setG] = useState<"jour" | "semaine" | "mois">("semaine");
  const s = useMemo(() => consultationSeries(db, g, today, est), [db, g, today, est]);
  return (
    <ComponentCard title="Consultations par période" actions={<PeriodSelect value={g} onChange={(v) => setG(v as typeof g)} options={[{ value: "jour", label: "14 jours" }, { value: "semaine", label: "12 semaines" }, { value: "mois", label: "6 mois" }]} />}>
      <BarChart labels={s.labels} series={[{ name: "Consultations", data: s.values }]} height={260} />
    </ComponentCard>
  );
}

export function SpeciesChartCard() {
  const { db } = useDemo();
  const s = useMemo(() => speciesDistribution(db), [db]);
  return (
    <ComponentCard title="Répartition des espèces suivies" desc="Patients vivants et lots d'élevage actifs">
      <DonutChart labels={s.labels} values={s.values} />
    </ComponentCard>
  );
}

export function EstablishmentActivityCard() {
  const { db, today } = useDemo();
  const s = useMemo(() => activityByEstablishment(db, { from: addDays(today, -90), to: today }), [db, today]);
  return (
    <ComponentCard title="Activité par établissement" desc="90 derniers jours">
      <BarChart
        labels={s.map((x) => x.name.replace("BIRCOVET ", ""))}
        series={[
          { name: "Consultations", data: s.map((x) => x.consultations) },
          { name: "Rendez-vous", data: s.map((x) => x.appointments) },
          { name: "Missions", data: s.map((x) => x.missions) },
        ]}
        height={260}
      />
    </ComponentCard>
  );
}

export function ExpensesChartCard({ est }: { est?: string }) {
  const { db, today, user } = useDemo();
  const [days, setDays] = useState("90");
  const s = useMemo(() => expensesByCategory(db, { from: addDays(today, -Number(days)), to: today, establishmentId: est }, user?.roleId === "dg"), [db, today, days, est, user]);
  return (
    <ComponentCard
      title="Répartition des dépenses"
      desc={user?.roleId === "dg" ? "Dépenses approuvées" : "Hors salaires (réservés au DG)"}
      actions={<PeriodSelect value={days} onChange={setDays} options={[{ value: "30", label: "30 jours" }, { value: "90", label: "90 jours" }, { value: "180", label: "6 mois" }]} />}
    >
      <DonutChart labels={s.labels} values={s.values} currency />
    </ComponentCard>
  );
}

export function SalesMixChartCard() {
  const { db, today } = useDemo();
  const s = useMemo(() => salesMix(db, 6, today), [db, today]);
  return (
    <ComponentCard title="Ventes de produits et services" desc="Factures validées, 6 derniers mois">
      <BarChart labels={s.labels} currency stacked series={[{ name: "Services", data: s.services }, { name: "Produits", data: s.products }]} height={260} />
    </ComponentCard>
  );
}
