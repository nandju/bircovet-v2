"use client";

import Can from "@/components/common/Can";
import ComponentCard from "@/components/common/ComponentCard";
import FilterBar from "@/components/common/FilterBar";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Panel from "@/components/common/Panel";
import StatusBadge from "@/components/common/StatusBadge";
import DataTable from "@/components/tables/DataTable";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useModal } from "@/hooks/useModal";
import { useRouter } from "@/i18n/navigation";
import { ChevronLeftIcon, PlusIcon } from "@/icons";
import { userName } from "@/lib/calc";
import { formatDate, isoDay } from "@/lib/format";
import { optionsOf } from "@/lib/labels";
import { cn } from "@/utils";
import { useMemo, useState } from "react";
import MissionFormModal from "./MissionFormModal";

export default function MissionsList() {
  const { db, today } = useDemo();
  const router = useRouter();
  const create = useModal();
  const [f, setF] = useState<Record<string, string>>({});
  const [month, setMonth] = useState(() => new Date());
  const rows = useMemo(() => db.missions.filter((m) => !f.status || m.status === f.status), [db, f]);
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, i) => new Date(month.getFullYear(), month.getMonth(), 1 - offset + i));
  return (
    <div className="space-y-4">
      <PageBreadcrumb
        pageTitle="Missions terrain"
        actions={
          <Can module="missions" action="create">
            <Button size="sm" startIcon={<PlusIcon />} onClick={create.openModal}>Nouvelle mission</Button>
          </Can>
        }
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 xl:gap-6">
        <Panel className="xl:col-span-2">
          <FilterBar values={f} onChange={(k, v) => setF((s) => ({ ...s, [k]: v }))} filters={[{ key: "status", label: "Tous statuts", options: optionsOf("mission") }]} />
          <DataTable
            rows={rows}
            rowKey={(m) => m.id}
            onRowClick={(m) => router.push(`/missions/${m.id}`)}
            initialSort={{ key: "d", dir: "desc" }}
            columns={[
              { key: "c", header: "Mission", primary: true, render: (m) => <span className="flex flex-col"><span className="font-medium">{m.code}</span><span className="text-theme-xs text-gray-500">{m.objective}</span></span> },
              { key: "d", header: "Date", sortValue: (m) => m.date, render: (m) => formatDate(m.date) },
              { key: "l", header: "Lieu", render: (m) => m.location, hideOnMobile: true },
              { key: "r", header: "Responsable", render: (m) => userName(db, m.leaderId) },
              { key: "e", header: "Équipe", align: "center", render: (m) => m.teamIds.length + 1 },
              { key: "st", header: "Stock transféré", align: "center", render: (m) => m.stock.reduce((s, l) => s + l.transferred, 0) || "—" },
              { key: "s", header: "Statut", render: (m) => <StatusBadge kind="mission" value={m.status} /> },
            ]}
            emptyTitle="Aucune mission"
          />
        </Panel>
        <ComponentCard
          title="Calendrier"
          actions={
            <span className="flex items-center gap-1">
              <Button size="xs" variant="ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} title="Mois précédent"><ChevronLeftIcon className="size-4 rtl:rotate-180" /></Button>
              <span className="text-sm capitalize">{month.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</span>
              <Button size="xs" variant="ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} title="Mois suivant"><ChevronLeftIcon className="size-4 rotate-180 rtl:rotate-0" /></Button>
            </span>
          }
        >
          <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
            {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => <span key={i} className="text-gray-400">{d}</span>)}
            {cells.map((d) => {
              const key = isoDay(d);
              const ms = db.missions.filter((m) => m.date <= key && m.endDate >= key && m.status !== "annulee");
              return (
                <button key={key} disabled={!ms.length} onClick={() => ms[0] && router.push(`/missions/${ms[0].id}`)} title={ms.map((m) => `${m.code} — ${m.objective}`).join("\n")} className={cn("flex aspect-square flex-col items-center justify-center rounded-lg text-xs", d.getMonth() !== month.getMonth() && "opacity-30", key === today && "ring-1 ring-brand-400", ms.length ? "bg-tertiary-50 font-semibold text-tertiary-700 dark:bg-tertiary-500/15 dark:text-tertiary-300" : "text-gray-600 dark:text-gray-400")}>
                  {d.getDate()}
                  {ms.length > 0 && <span className="size-1 rounded-full bg-tertiary-500" />}
                </button>
              );
            })}
          </div>
        </ComponentCard>
      </div>
      <MissionFormModal isOpen={create.isOpen} onClose={create.closeModal} onCreated={(id) => router.push(`/missions/${id}`)} />
    </div>
  );
}
