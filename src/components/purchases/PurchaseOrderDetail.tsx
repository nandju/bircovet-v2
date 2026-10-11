"use client";

import ComponentCard from "@/components/common/ComponentCard";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import InfoGrid from "@/components/common/InfoGrid";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import StatusBadge from "@/components/common/StatusBadge";
import DataTable from "@/components/tables/DataTable";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useModal } from "@/hooks/useModal";
import { Link } from "@/i18n/navigation";
import { PrinterIcon } from "@/icons";
import { productName, supplierName, userName } from "@/lib/calc";
import { formatDate, formatXOF } from "@/lib/format";
import { receivedForLine, setPOStatus } from "@/lib/services/suppliersService";
import type { PurchaseOrder } from "@/lib/types";
import { printPage } from "@/utils/export";
import { useState } from "react";
import { PurchaseOrderModal, ReceptionModal } from "./PurchaseModals";

export default function PurchaseOrderDetail({ id }: { id: string }) {
  const { db, run, can } = useDemo();
  const edit = useModal();
  const [receive, setReceive] = useState<PurchaseOrder | null>(null);
  const [statusAction, setStatusAction] = useState<"annulee" | "cloturee" | null>(null);
  const po = db.purchaseOrders.find((p) => p.id === id);
  if (!po) return <p className="text-sm text-gray-500">Commande introuvable.</p>;
  const receptions = db.receptions.filter((r) => r.poId === po.id);
  const total = po.lines.reduce((s, l) => s + l.qtyOrdered * l.unitPrice, 0);
  const manage = can("achats", "create");
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb
        pageTitle={`Commande ${po.code}`}
        subtitle={supplierName(db, po.supplierId)}
        trail={[{ label: "Commandes", href: "/achats" }]}
        actions={
          <>
            <Button size="sm" variant="outline" startIcon={<PrinterIcon />} onClick={printPage}>
              Imprimer
            </Button>
            {manage && po.status === "brouillon" && (
              <>
                <Button size="sm" variant="outline" onClick={edit.openModal}>
                  Modifier
                </Button>
                <Button size="sm" variant="secondary" onClick={() => run(setPOStatus, { id: po.id, status: "envoyee" })}>
                  Envoyer (simulation)
                </Button>
              </>
            )}
            {(po.status === "envoyee" || po.status === "partiellement_recue") && can("stock", "create") && (
              <Button size="sm" onClick={() => setReceive(po)}>
                Réceptionner
              </Button>
            )}
            {manage && (po.status === "brouillon" || po.status === "envoyee") && (
              <Button size="sm" variant="ghost" className="text-error-600" onClick={() => setStatusAction("annulee")}>
                Annuler
              </Button>
            )}
            {manage && (po.status === "partiellement_recue" || po.status === "recue") && (
              <Button size="sm" variant="outline" onClick={() => setStatusAction("cloturee")}>
                Clôturer
              </Button>
            )}
          </>
        }
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <ComponentCard title="Informations" className="lg:col-span-1">
          <InfoGrid
            cols={2}
            items={[
              { label: "Statut", value: <StatusBadge kind="po" value={po.status} /> },
              { label: "Date", value: formatDate(po.date) },
              { label: "Livraison attendue", value: formatDate(po.expectedDate) },
              { label: "Auteur", value: userName(db, po.authorId) },
              { label: "Montant", value: formatXOF(total) },
              { label: "Notes", value: po.notes, wide: true },
            ]}
          />
        </ComponentCard>
        <ComponentCard title="Lignes : commandé / reçu / écart" className="lg:col-span-2">
          <DataTable
            rows={po.lines}
            rowKey={(l) => l.id}
            columns={[
              { key: "p", header: "Article", primary: true, render: (l) => productName(db, l.productId) },
              { key: "o", header: "Commandé", align: "end", render: (l) => l.qtyOrdered },
              { key: "r", header: "Reçu (validé)", align: "end", render: (l) => receivedForLine(db, l.id) },
              { key: "g", header: "Écart", align: "end", render: (l) => { const g = receivedForLine(db, l.id) - l.qtyOrdered; return <span className={g < 0 ? "font-medium text-warning-600" : g > 0 ? "font-medium text-tertiary-600" : "text-success-600"}>{g === 0 ? "0" : g > 0 ? `+${g}` : g}</span>; } },
              { key: "u", header: "Prix unit.", align: "end", render: (l) => formatXOF(l.unitPrice) },
              { key: "t", header: "Total", align: "end", render: (l) => formatXOF(l.qtyOrdered * l.unitPrice) },
            ]}
          />
        </ComponentCard>
      </div>
      <ComponentCard title="Réceptions liées" actions={<Link href="/achats/receptions" className="text-sm font-medium text-brand-600">Toutes les réceptions</Link>}>
        <DataTable
          rows={receptions}
          rowKey={(r) => r.id}
          emptyTitle="Aucune réception"
          columns={[
            { key: "c", header: "Réception", primary: true, render: (r) => r.code },
            { key: "d", header: "Date", render: (r) => formatDate(r.date) },
            { key: "b", header: "BL", render: (r) => r.deliveryNoteRef },
            { key: "q", header: "Reçu / attendu", render: (r) => `${r.lines.reduce((s, l) => s + l.qtyReceived, 0)} / ${r.lines.reduce((s, l) => s + l.qtyOrdered, 0)}` },
            { key: "s", header: "Statut", render: (r) => <StatusBadge kind="reception" value={r.status} /> },
          ]}
        />
      </ComponentCard>
      <p className="hidden text-theme-xs text-gray-500 print:block">Bon de commande de démonstration — envoi au fournisseur simulé.</p>
      <PurchaseOrderModal isOpen={edit.isOpen} onClose={edit.closeModal} po={po} />
      <ReceptionModal po={receive} onClose={() => setReceive(null)} />
      <ConfirmDialog isOpen={!!statusAction} onClose={() => setStatusAction(null)} title={statusAction === "annulee" ? "Annuler la commande" : "Clôturer la commande"} message={statusAction === "cloturee" ? "Les reliquats non reçus ne seront plus attendus ; l'écart reste visible." : "La commande sera annulée."} reasonLabel="Motif" tone={statusAction === "annulee" ? "danger" : "primary"} onConfirm={(reason) => (statusAction ? run(setPOStatus, { id: po.id, status: statusAction, reason }).ok : false)} />
    </div>
  );
}
