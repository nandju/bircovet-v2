"use client";

import AppModal from "@/components/common/AppModal";
import Can from "@/components/common/Can";
import FilterBar from "@/components/common/FilterBar";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Panel from "@/components/common/Panel";
import StatusBadge from "@/components/common/StatusBadge";
import { FormGrid, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import DataTable, { type Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useModal } from "@/hooks/useModal";
import { useOptions } from "@/hooks/useOptions";
import { useRouter } from "@/i18n/navigation";
import { PlusIcon } from "@/icons";
import { clientName } from "@/lib/calc";
import { formatDate, normalize } from "@/lib/format";
import { optionsOf } from "@/lib/labels";
import { createFarm, currentHeadcount, type FarmInput } from "@/lib/services/farmsService";
import type { Farm } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

const EMPTY: FarmInput = { name: "", clientId: "", type: "avicole", location: "", region: "", gps: "", access: "", managerName: "", managerPhone: "", status: "actif" };

export function FarmFormModal({ isOpen, onClose, initial, onSave }: { isOpen: boolean; onClose: () => void; initial?: FarmInput; onSave: (v: FarmInput) => boolean }) {
  const opts = useOptions();
  const [v, setV] = useState<FarmInput>(EMPTY);
  useEffect(() => {
    if (isOpen) setV(initial ?? EMPTY);
  }, [isOpen, initial]);
  const set = <K extends keyof FarmInput>(k: K, x: FarmInput[K]) => setV((s) => ({ ...s, [k]: x }));
  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={initial ? "Modifier l'exploitation" : "Nouvelle exploitation"}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Annuler
          </Button>
          <Button size="sm" disabled={!v.name.trim() || !v.clientId} onClick={() => onSave(v) && onClose()}>
            Enregistrer
          </Button>
        </>
      }
    >
      <FormGrid>
        <TextField label="Nom de l'exploitation" required value={v.name} onChange={(x) => set("name", x)} />
        <SelectField label="Client associé" required value={v.clientId} onChange={(x) => set("clientId", x)} options={opts.clients} />
        <SelectField label="Type d'élevage" value={v.type} onChange={(x) => set("type", x as FarmInput["type"])} options={optionsOf("farmType")} />
        <SelectField label="Statut" value={v.status} onChange={(x) => set("status", x as FarmInput["status"])} options={optionsOf("farm")} />
        <TextField label="Localité" value={v.location} onChange={(x) => set("location", x)} />
        <TextField label="Région" value={v.region} onChange={(x) => set("region", x)} />
        <TextField label="Responsable sur site" value={v.managerName} onChange={(x) => set("managerName", x)} />
        <TextField label="Téléphone du responsable" value={v.managerPhone} onChange={(x) => set("managerPhone", x)} />
        <TextField label="Coordonnées GPS (fictives)" value={v.gps} onChange={(x) => set("gps", x)} />
        <TextAreaField label="Informations d'accès" value={v.access} onChange={(x) => set("access", x)} rows={2} />
      </FormGrid>
    </AppModal>
  );
}

export default function FarmsList() {
  const { db, run } = useDemo();
  const router = useRouter();
  const create = useModal();
  const [q, setQ] = useState("");
  const [f, setF] = useState<Record<string, string>>({});
  const regions = Array.from(new Set(db.farms.map((x) => x.region))).map((r) => ({ value: r, label: r }));
  const managers = Array.from(new Set(db.farms.map((x) => x.managerName))).map((r) => ({ value: r, label: r }));
  const rows = useMemo(() => {
    const t = normalize(q);
    return db.farms.filter((x) => (!f.type || x.type === f.type) && (!f.status || x.status === f.status) && (!f.region || x.region === f.region) && (!f.manager || x.managerName === f.manager) && (!t || normalize(`${x.name} ${x.code} ${x.location} ${clientName(db, x.clientId)}`).includes(t)));
  }, [db, q, f]);

  const columns: Column<Farm>[] = [
    { key: "n", header: "Exploitation", primary: true, sortValue: (x) => x.name, render: (x) => <span className="flex flex-col"><span className="font-medium text-gray-800 dark:text-white/90">{x.name}</span><span className="text-theme-xs text-gray-500">{x.code}</span></span> },
    { key: "t", header: "Type", render: (x) => <StatusBadge kind="farmType" value={x.type} /> },
    { key: "c", header: "Client", render: (x) => clientName(db, x.clientId) },
    { key: "l", header: "Localisation", sortValue: (x) => x.location, render: (x) => `${x.location} (${x.region})` },
    { key: "m", header: "Responsable", render: (x) => x.managerName, hideOnMobile: true },
    { key: "e", header: "Effectif actuel", align: "end", sortValue: (x) => x.lots.reduce((s, l) => s + currentHeadcount(x, l.id), 0), render: (x) => x.lots.reduce((s, l) => s + currentHeadcount(x, l.id), 0).toLocaleString("fr-FR") },
    { key: "v", header: "Dernière visite", render: (x) => formatDate([...x.visits].sort((a, b) => b.date.localeCompare(a.date))[0]?.date), hideOnMobile: true },
    { key: "s", header: "Statut", render: (x) => <StatusBadge kind="farm" value={x.status} /> },
  ];

  return (
    <div>
      <PageBreadcrumb
        pageTitle="Exploitations et élevages"
        actions={
          <Can module="exploitations" action="create">
            <Button size="sm" startIcon={<PlusIcon />} onClick={create.openModal}>
              Nouvelle exploitation
            </Button>
          </Can>
        }
      />
      <Panel>
        <FilterBar
          search={q}
          onSearch={setQ}
          searchPlaceholder="Nom, localité, client…"
          values={f}
          onChange={(k, v) => setF((s) => ({ ...s, [k]: v }))}
          filters={[
            { key: "type", label: "Tous les types", options: optionsOf("farmType") },
            { key: "region", label: "Toutes les régions", options: regions },
            { key: "manager", label: "Tous les responsables", options: managers },
            { key: "status", label: "Tous les statuts", options: optionsOf("farm") },
          ]}
        />
        <DataTable rows={rows} columns={columns} rowKey={(x) => x.id} onRowClick={(x) => router.push(`/exploitations/${x.id}`)} emptyTitle="Aucune exploitation" />
      </Panel>
      <FarmFormModal
        isOpen={create.isOpen}
        onClose={create.closeModal}
        onSave={(v) => {
          const r = run(createFarm, v);
          if (r.ok && r.data) router.push(`/exploitations/${r.data}`);
          return r.ok;
        }}
      />
    </div>
  );
}
