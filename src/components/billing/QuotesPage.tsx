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
  const legacy = db.invoices.filter((i) => i.kind === "proforma");
  const rows = useMemo(() => db.quotes.filter((x) => (!f.status || x.status === f.status) && (!q || normalize(`${x.code} ${clientName(db, x.clientId)}`).includes(normalize(q)))), [db, q, f]);
  return (
    <div>
      <PageBreadcrumb
        pageTitle="Devis / pro forma"
        subtitle="Un seul document : il sert de devis comme de facture pro forma, puis se convertit en facture."
        trail={[{ label: "Facturation", href: "/facturation" }]}
        actions={
          <Can module="facturation" action="create">
            <Button size="sm" startIcon={<PlusIcon />} onClick={create.openModal}>
              Nouveau devis / pro forma
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
      {legacy.length > 0 && (
        <Panel className="mt-4">
          <p className="px-4 pt-3 text-sm font-semibold text-gray-800 dark:text-white/90">Anciens pro forma ({legacy.length})</p>
          <p className="px-4 text-theme-xs text-gray-500">Créés avant la fusion devis / pro forma : ils restent consultables et convertibles.</p>
          <ul className="divide-y divide-gray-100 px-4 py-2 dark:divide-gray-800">
            {legacy.map((p) => (
              <li key={p.id}><button type="button" onClick={() => router.push(`/facturation/factures/${p.id}`)} className="flex w-full justify-between gap-2 py-2 text-start text-sm hover:text-brand-600"><span>{p.code} · {clientName(db, p.clientId)} · {formatDate(p.date)}</span><span className="tabular-nums">{formatXOF(docTotal(p.lines))}</span></button></li>
            ))}
          </ul>
        </Panel>
      )}
      <DocumentEditorModal isOpen={create.isOpen} onClose={create.closeModal} kind="devis" onCreated={(id) => router.push(`/facturation/devis/${id}`)} />
    </div>
  );
}
