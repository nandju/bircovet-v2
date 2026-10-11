"use client";

import Can from "@/components/common/Can";
import ComponentCard from "@/components/common/ComponentCard";
import InfoGrid from "@/components/common/InfoGrid";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import StatusBadge from "@/components/common/StatusBadge";
import DataTable from "@/components/tables/DataTable";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useModal } from "@/hooks/useModal";
import { useRouter } from "@/i18n/navigation";
import { PencilIcon } from "@/icons";
import { formatDate, formatXOF } from "@/lib/format";
import { SupplierModal } from "./PurchaseModals";

export default function SupplierDetail({ id }: { id: string }) {
  const { db } = useDemo();
  const router = useRouter();
  const edit = useModal();
  const s = db.suppliers.find((x) => x.id === id);
  if (!s) return <p className="text-sm text-gray-500">Fournisseur introuvable.</p>;
  const pos = db.purchaseOrders.filter((p) => p.supplierId === s.id);
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb
        pageTitle={s.name}
        subtitle={s.code}
        trail={[{ label: "Fournisseurs", href: "/achats/fournisseurs" }]}
        actions={
          <Can module="achats" action="create">
            <Button size="sm" variant="outline" startIcon={<PencilIcon />} onClick={edit.openModal}>
              Modifier
            </Button>
          </Can>
        }
      />
      <ComponentCard title="Fiche fournisseur">
        <InfoGrid
          cols={3}
          items={[
            { label: "Catégorie", value: s.category },
            { label: "Contact", value: s.contactName },
            { label: "Téléphone", value: s.phone },
            { label: "E-mail", value: s.email },
            { label: "Conditions", value: s.paymentTerms },
            { label: "Statut", value: <StatusBadge kind="supplier" value={s.status} /> },
            { label: "Adresse", value: s.address, wide: true },
          ]}
        />
      </ComponentCard>
      <ComponentCard title="Historique des achats">
        <DataTable
          rows={pos}
          rowKey={(p) => p.id}
          onRowClick={(p) => router.push(`/achats/commandes/${p.id}`)}
          emptyTitle="Aucune commande"
          columns={[
            { key: "c", header: "Commande", primary: true, render: (p) => p.code },
            { key: "d", header: "Date", render: (p) => formatDate(p.date) },
            { key: "t", header: "Montant", align: "end", render: (p) => formatXOF(p.lines.reduce((x, l) => x + l.qtyOrdered * l.unitPrice, 0)) },
            { key: "s", header: "Statut", render: (p) => <StatusBadge kind="po" value={p.status} /> },
          ]}
        />
      </ComponentCard>
      <ComponentCard title="Articles référencés">
        <DataTable rows={db.products.filter((p) => p.supplierId === s.id)} rowKey={(p) => p.id} onRowClick={(p) => router.push(`/stock/articles/${p.id}`)} columns={[{ key: "n", header: "Article", primary: true, render: (p) => p.name }, { key: "c", header: "Code", render: (p) => p.code }, { key: "pa", header: "Prix d'achat", align: "end", render: (p) => formatXOF(p.purchasePrice) }]} emptyTitle="Aucun article" />
      </ComponentCard>
      <SupplierModal isOpen={edit.isOpen} onClose={edit.closeModal} supplier={s} />
    </div>
  );
}
