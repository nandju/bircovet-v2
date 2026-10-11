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
import { useOptions } from "@/hooks/useOptions";
import { useQueryParam } from "@/hooks/useQueryFlag";
import { useRouter } from "@/i18n/navigation";
import { PlusIcon } from "@/icons";
import { supplierName } from "@/lib/calc";
import { formatDate, formatXOF } from "@/lib/format";
import { optionsOf } from "@/lib/labels";
import { useEffect, useMemo, useState } from "react";
import { PurchaseOrderModal } from "./PurchaseModals";

export default function PurchaseOrdersPage() {
  const { db } = useDemo();
  const opts = useOptions();
  const router = useRouter();
  const create = useModal();
  const nouveau = useQueryParam("nouveau");
  const openCreate = create.openModal;
  useEffect(() => {
    if (nouveau) openCreate();
  }, [nouveau, openCreate]);
  const [f, setF] = useState<Record<string, string>>({});
  const rows = useMemo(() => db.purchaseOrders.filter((p) => (!f.status || p.status === f.status) && (!f.supplier || p.supplierId === f.supplier)), [db, f]);
  return (
    <div>
      <PageBreadcrumb
        pageTitle="Commandes d'achat"
        trail={[{ label: "Achats", href: "/achats" }]}
        actions={
          <Can module="achats" action="create">
            <Button size="sm" startIcon={<PlusIcon />} onClick={create.openModal}>
              Nouvelle commande
            </Button>
          </Can>
        }
      />
      <Panel>
        <FilterBar values={f} onChange={(k, v) => setF((s) => ({ ...s, [k]: v }))} filters={[{ key: "status", label: "Tous statuts", options: optionsOf("po") }, { key: "supplier", label: "Tous fournisseurs", options: opts.suppliers }]} />
        <DataTable
          rows={rows}
          rowKey={(p) => p.id}
          onRowClick={(p) => router.push(`/achats/commandes/${p.id}`)}
          initialSort={{ key: "d", dir: "desc" }}
          columns={[
            { key: "c", header: "Commande", primary: true, render: (p) => <span className="font-medium">{p.code}</span> },
            { key: "s", header: "Fournisseur", render: (p) => supplierName(db, p.supplierId) },
            { key: "d", header: "Date", sortValue: (p) => p.date, render: (p) => formatDate(p.date) },
            { key: "e", header: "Livraison attendue", render: (p) => formatDate(p.expectedDate), hideOnMobile: true },
            { key: "l", header: "Lignes", align: "center", render: (p) => p.lines.length },
            { key: "t", header: "Montant", align: "end", render: (p) => formatXOF(p.lines.reduce((s, l) => s + l.qtyOrdered * l.unitPrice, 0)) },
            { key: "st", header: "Statut", render: (p) => <StatusBadge kind="po" value={p.status} /> },
          ]}
          emptyTitle="Aucune commande"
        />
      </Panel>
      <PurchaseOrderModal isOpen={create.isOpen} onClose={create.closeModal} onCreated={(id) => router.push(`/achats/commandes/${id}`)} />
    </div>
  );
}
