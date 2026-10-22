"use client";

import Can from "@/components/common/Can";
import FilterBar from "@/components/common/FilterBar";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Panel from "@/components/common/Panel";
import StatusBadge from "@/components/common/StatusBadge";
import DataTable from "@/components/tables/DataTable";
import Button from "@/components/ui/button/Button";
import Tabs from "@/components/ui/tabs/Tabs";
import { useDemo } from "@/context/DemoStoreContext";
import { useOptions } from "@/hooks/useOptions";
import { useRouter } from "@/i18n/navigation";
import { DownloadIcon, PlusIcon } from "@/icons";
import { clientName, patientName, userName } from "@/lib/calc";
import { addDays, formatDateTime, normalize } from "@/lib/format";
import { labelOf, optionsOf } from "@/lib/labels";
import { exportCsv } from "@/utils/export";
import { useMemo, useState } from "react";

export default function ConsultationsList() {
  const { db, user, today } = useDemo();
  const opts = useOptions();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [f, setF] = useState<Record<string, string>>({});
  const [period, setPeriod] = useState("30");
  const shared = useMemo(() => (user?.roleId === "confrere" ? new Set(user.sharedPatientIds ?? []) : null), [user]);
  const rows = useMemo(() => {
    const t = normalize(q);
    const from = period === "all" ? "" : addDays(today, -Number(period));
    return db.consultations.filter(
      (c) =>
        (!shared || (shared.has(c.patientId) && c.status === "valide")) &&
        c.date.slice(0, 10) >= from &&
        (!f.status || c.status === f.status) &&
        (!f.financial || c.financialStatus === f.financial) &&
        (!f.vet || c.vetId === f.vet) &&
        (!t || normalize(`${c.code} ${c.reason} ${patientName(db, c.patientId)} ${clientName(db, c.clientId)}`).includes(t)),
    );
  }, [db, q, f, period, today, shared]);
  const pending = db.consultations.filter((c) => c.status === "a_valider").length;

  return (
    <div>
      <PageBreadcrumb
        pageTitle="Consultations"
        subtitle={`${pending} dossier(s) en attente de validation`}
        actions={
          <>
            <Button size="sm" variant="outline" startIcon={<DownloadIcon />} onClick={() => exportCsv("cliva-consultations-demo", ["Code", "Date", "Patient", "Client", "Motif", "Responsable", "Statut clinique", "Statut financier"], rows.map((c) => [c.code, formatDateTime(c.date), patientName(db, c.patientId), clientName(db, c.clientId), c.reason, userName(db, c.vetId), labelOf("clinical", c.status), labelOf("financial", c.financialStatus)]))}>
              Export CSV
            </Button>
            <Can module="consultations" action="create">
              <Button size="sm" startIcon={<PlusIcon />} onClick={() => router.push("/consultations/nouvelle")}>
                Nouvelle consultation
              </Button>
            </Can>
          </>
        }
      />
      <Panel>
        <div className="px-4 pb-3">
          <Tabs tabs={[{ key: "7", label: "7 jours" }, { key: "30", label: "30 jours" }, { key: "90", label: "90 jours" }, { key: "all", label: "Tout" }]} active={period} onChange={setPeriod} />
        </div>
        <FilterBar
          search={q}
          onSearch={setQ}
          searchPlaceholder="Code, motif, patient, client…"
          values={f}
          onChange={(k, v) => setF((s) => ({ ...s, [k]: v }))}
          filters={[
            { key: "status", label: "Tous statuts cliniques", options: optionsOf("clinical") },
            { key: "financial", label: "Tous statuts financiers", options: optionsOf("financial") },
            { key: "vet", label: "Tous les vétérinaires", options: opts.vets },
          ]}
        />
        <DataTable
          rows={rows}
          rowKey={(c) => c.id}
          onRowClick={(c) => router.push(`/consultations/${c.id}`)}
          initialSort={{ key: "d", dir: "desc" }}
          columns={[
            { key: "d", header: "Date", primary: true, sortValue: (c) => c.date, render: (c) => <span className="flex flex-col"><span className="font-medium">{c.code}</span><span className="text-theme-xs text-gray-500">{formatDateTime(c.date)}</span></span> },
            { key: "p", header: "Patient", sortValue: (c) => patientName(db, c.patientId), render: (c) => patientName(db, c.patientId) },
            { key: "c", header: "Client", render: (c) => clientName(db, c.clientId), hideOnMobile: true },
            { key: "r", header: "Motif", render: (c) => c.reason },
            { key: "v", header: "Responsable", render: (c) => userName(db, c.vetId) },
            { key: "s", header: "Clinique", render: (c) => <StatusBadge kind="clinical" value={c.status} /> },
            { key: "f", header: "Financier", render: (c) => <StatusBadge kind="financial" value={c.financialStatus} /> },
          ]}
          emptyTitle="Aucune consultation sur la période"
        />
      </Panel>
    </div>
  );
}
