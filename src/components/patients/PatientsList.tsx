"use client";

import Can from "@/components/common/Can";
import FilterBar from "@/components/common/FilterBar";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Panel from "@/components/common/Panel";
import StatusBadge from "@/components/common/StatusBadge";
import DataTable, { type Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useModal } from "@/hooks/useModal";
import { useQueryParam } from "@/hooks/useQueryFlag";
import { useRouter } from "@/i18n/navigation";
import { AlertTriangleIcon, DownloadIcon, PlusIcon } from "@/icons";
import { clientName } from "@/lib/calc";
import { ageFrom, formatDate, normalize } from "@/lib/format";
import { labelOf, optionsOf, SPECIES } from "@/lib/labels";
import type { Patient } from "@/lib/types";
import { exportCsv } from "@/utils/export";
import { useEffect, useMemo, useState } from "react";
import PatientFormModal from "./PatientFormModal";

export default function PatientsList() {
  const { db, user } = useDemo();
  const router = useRouter();
  const create = useModal();
  const nouveau = useQueryParam("nouveau");
  const defaultClient = useQueryParam("client") ?? undefined;
  const [q, setQ] = useState("");
  const [f, setF] = useState<Record<string, string>>({ vital: "vivant" });
  const openCreate = create.openModal;
  useEffect(() => {
    if (nouveau) openCreate();
  }, [nouveau, openCreate]);

  const shared = useMemo(() => (user?.roleId === "confrere" ? new Set(user.sharedPatientIds ?? []) : null), [user]);
  const rows = useMemo(() => {
    const t = normalize(q);
    return db.patients.filter(
      (p) =>
        (!shared || shared.has(p.id)) &&
        (!f.species || p.species === f.species) &&
        (!f.vital || p.vitalStatus === f.vital) &&
        (!t || normalize(`${p.name} ${p.code} ${p.breed} ${p.chip} ${clientName(db, p.ownerId)}`).includes(t)),
    );
  }, [db, q, f, shared]);

  const columns: Column<Patient>[] = [
    {
      key: "name",
      header: "Patient",
      primary: true,
      sortValue: (p) => p.name,
      render: (p) => (
        <span className="flex items-center gap-2">
          <span className="flex flex-col">
            <span className="font-medium text-gray-800 dark:text-white/90">{p.name}</span>
            <span className="text-theme-xs text-gray-500">{p.code}</span>
          </span>
          {(p.alerts.length > 0 || p.allergies.length > 0) && <AlertTriangleIcon className="size-4 text-warning-500" aria-label="Alerte clinique" />}
        </span>
      ),
    },
    { key: "species", header: "Espèce / race", sortValue: (p) => p.species, render: (p) => `${p.species} — ${p.breed || "—"}` },
    { key: "sex", header: "Sexe", render: (p) => labelOf("sex", p.sex), hideOnMobile: true },
    { key: "age", header: "Âge", sortValue: (p) => p.birthDate, render: (p) => `${ageFrom(p.birthDate)}${p.birthDateEstimated ? " (est.)" : ""}` },
    { key: "owner", header: "Propriétaire", sortValue: (p) => clientName(db, p.ownerId), render: (p) => clientName(db, p.ownerId) },
    { key: "weight", header: "Dernier poids", align: "end", render: (p) => (p.vitals.length ? `${p.vitals[p.vitals.length - 1].weightKg} kg` : "—"), hideOnMobile: true },
    { key: "vital", header: "Statut", render: (p) => <StatusBadge kind="vital" value={p.vitalStatus} /> },
  ];

  return (
    <div>
      <PageBreadcrumb
        pageTitle="Patients"
        subtitle={shared ? "Dossiers partagés avec vous" : `${db.patients.filter((p) => p.vitalStatus === "vivant").length} animaux suivis`}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              startIcon={<DownloadIcon />}
              onClick={() => exportCsv("cliva-patients-demo", ["Code", "Nom", "Espèce", "Race", "Sexe", "Naissance", "Propriétaire", "Statut"], rows.map((p) => [p.code, p.name, p.species, p.breed, labelOf("sex", p.sex), formatDate(p.birthDate), clientName(db, p.ownerId), labelOf("vital", p.vitalStatus)]))}
            >
              Export CSV
            </Button>
            <Can module="patients" action="create">
              <Button size="sm" startIcon={<PlusIcon />} onClick={create.openModal}>
                Nouveau patient
              </Button>
            </Can>
          </>
        }
      />
      <Panel>
        <FilterBar
          search={q}
          onSearch={setQ}
          searchPlaceholder="Nom, code, puce, propriétaire…"
          values={f}
          onChange={(k, v) => setF((s) => ({ ...s, [k]: v }))}
          filters={[
            { key: "species", label: "Toutes les espèces", options: SPECIES.map((s) => ({ value: s, label: s })) },
            { key: "vital", label: "Tous les statuts", options: optionsOf("vital") },
          ]}
        />
        <DataTable rows={rows} columns={columns} rowKey={(p) => p.id} onRowClick={(p) => router.push(`/patients/${p.id}`)} initialSort={{ key: "name", dir: "asc" }} emptyTitle="Aucun patient trouvé" />
      </Panel>
      <PatientFormModal isOpen={create.isOpen} onClose={create.closeModal} defaultOwnerId={defaultClient} onCreated={(id) => router.push(`/patients/${id}`)} />
    </div>
  );
}
