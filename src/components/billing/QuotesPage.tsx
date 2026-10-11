"use client";

import Can from "@/components/common/Can";
import FilterBar from "@/components/common/FilterBar";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Panel from "@/components/common/Panel";
import StatusBadge from "@/components/common/StatusBadge";
import DataTable from "@/components/tables/DataTable";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useModal } from "@/hooks/useModal";
import { useQueryParam } from "@/hooks/useQueryFlag";
import { useRouter } from "@/i18n/navigation";
import { PlusIcon } from "@/icons";
import { clientName, docTotal } from "@/lib/calc";
import { formatDate, formatXOF, normalize } from "@/lib/format";
import { optionsOf } from "@/lib/labels";
import { useEffect, useMemo, useState } from "react";
import { DocumentEditorModal } from "./BillingModals";

export default function QuotesPage() {
  const { db } = useDemo();
  const router = useRouter();
  const create = useModal();
  const nouveau = useQueryParam("nouveau");
  const openCreate = create.openModal;
  useEffect(() => {
    if (nouveau) openCreate();
  }, [nouveau, openCreate]);
  const [q, setQ] = useState("");
  const [f, setF] = useState<Record<string, string>>({});
  const rows = useMemo(() => db.quotes.filter((x) => (!f.status || x.status === f.status) && (!q || normalize(`${x.code} ${clientName(db, x.clientId)}`).includes(normalize(q)))), [db, q, f]);
  return (
    <div>
      <PageBreadcrumb
        pageTitle="Devis"
        trail={[{ label: "Facturation", href: "/facturation" }]}
        actions={
          <Can module="facturation" action="create">
            <Button size="sm" startIcon={<PlusIcon />} onClick={create.openModal}>
              Nouveau devis
            </Button>
          </Can>
        }
      />
      <Panel>
        <FilterBar search={q} onSearch={setQ} values={f} onChange={(k, v) => setF((s) => ({ ...s, [k]: v }))} filters={[{ key: "status", label: "Tous statuts", options: optionsOf("quote") }]} />
        <DataTable
          rows={rows}
          rowKey={(x) => x.id}
          onRowClick={(x) => router.push(`/facturation/devis/${x.id}`)}
          initialSort={{ key: "d", dir: "desc" }}
          columns={[
            { key: "c", header: "Devis", primary: true, render: (x) => <span className="font-medium">{x.code}</span> },
            { key: "d", header: "Date", sortValue: (x) => x.date, render: (x) => formatDate(x.date) },
            { key: "cl", header: "Client", render: (x) => clientName(db, x.clientId) },
            { key: "v", header: "Valable jusqu'au", render: (x) => formatDate(x.validUntil), hideOnMobile: true },
            { key: "t", header: "Montant", align: "end", render: (x) => formatXOF(docTotal(x.lines)) },
            { key: "s", header: "Statut", render: (x) => <StatusBadge kind="quote" value={x.status} /> },
          ]}
          emptyTitle="Aucun devis"
        />
      </Panel>
      <DocumentEditorModal isOpen={create.isOpen} onClose={create.closeModal} kind="devis" onCreated={(id) => router.push(`/facturation/devis/${id}`)} />
    </div>
  );
}
