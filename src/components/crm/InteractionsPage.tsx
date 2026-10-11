"use client";

import AppModal from "@/components/common/AppModal";
import Can from "@/components/common/Can";
import FilterBar from "@/components/common/FilterBar";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Panel from "@/components/common/Panel";
import { SelectField, TextAreaField } from "@/components/form/Field";
import DataTable from "@/components/tables/DataTable";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useModal } from "@/hooks/useModal";
import { useOptions } from "@/hooks/useOptions";
import { clientName, userName } from "@/lib/calc";
import { formatDateTime } from "@/lib/format";
import { logInteraction } from "@/lib/services/tasksService";
import type { Interaction } from "@/lib/types";
import { useMemo, useState } from "react";

const CHANNELS = [
  { value: "appel", label: "Appel" },
  { value: "visite", label: "Visite" },
  { value: "sms", label: "SMS" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "E-mail" },
];

export default function InteractionsPage() {
  const { db, run } = useDemo();
  const opts = useOptions();
  const create = useModal();
  const [f, setF] = useState<Record<string, string>>({});
  const [v, setV] = useState({ clientId: "", channel: "appel" as Interaction["channel"], summary: "" });
  const rows = useMemo(() => db.interactions.filter((i) => (!f.client || i.clientId === f.client) && (!f.channel || i.channel === f.channel)), [db, f]);
  return (
    <div>
      <PageBreadcrumb
        pageTitle="Historique des interactions"
        trail={[{ label: "Relation client", href: "/relation-client" }]}
        actions={
          <Can module="relation" action="update">
            <Button size="sm" onClick={() => { setV({ clientId: "", channel: "appel", summary: "" }); create.openModal(); }}>Consigner une interaction</Button>
          </Can>
        }
      />
      <Panel>
        <FilterBar values={f} onChange={(k, val) => setF((s) => ({ ...s, [k]: val }))} filters={[{ key: "client", label: "Tous clients", options: opts.clients }, { key: "channel", label: "Tous canaux", options: CHANNELS }]} />
        <DataTable
          rows={rows}
          rowKey={(i) => i.id}
          initialSort={{ key: "d", dir: "desc" }}
          columns={[
            { key: "d", header: "Date", primary: true, sortValue: (i) => i.date, render: (i) => formatDateTime(i.date) },
            { key: "c", header: "Client", render: (i) => clientName(db, i.clientId) },
            { key: "ch", header: "Canal", render: (i) => CHANNELS.find((c) => c.value === i.channel)?.label },
            { key: "s", header: "Résumé", render: (i) => <span>{i.summary} {i.simulated && <span className="ms-1 rounded-full bg-warning-50 px-1.5 text-[10px] font-medium text-warning-700 dark:bg-warning-500/15">simulé</span>}</span> },
            { key: "u", header: "Par", hideOnMobile: true, render: (i) => userName(db, i.userId) },
          ]}
          emptyTitle="Aucune interaction"
        />
      </Panel>
      <AppModal
        isOpen={create.isOpen}
        onClose={create.closeModal}
        title="Consigner une interaction"
        footer={
          <>
            <Button size="sm" variant="outline" onClick={create.closeModal}>Annuler</Button>
            <Button size="sm" disabled={!v.clientId || !v.summary.trim()} onClick={() => run(logInteraction, v).ok && create.closeModal()}>Enregistrer</Button>
          </>
        }
      >
        <div className="space-y-4">
          <SelectField label="Client" required value={v.clientId} onChange={(clientId) => setV({ ...v, clientId })} options={opts.clients} />
          <SelectField label="Canal" value={v.channel} onChange={(x) => setV({ ...v, channel: x as Interaction["channel"] })} options={CHANNELS} />
          <TextAreaField label="Résumé" required value={v.summary} onChange={(summary) => setV({ ...v, summary })} rows={3} />
        </div>
      </AppModal>
    </div>
  );
}
