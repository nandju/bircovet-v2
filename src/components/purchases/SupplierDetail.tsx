"use client";

import { BillFormModal, BillItem, PayBillModal } from "@/components/payables/PayablesParts";
import { billState, debtsBySupplier, type BillState } from "@/lib/payables";
import { useState } from "react";
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
import { PencilIcon, PlusIcon } from "@/icons";
import { formatDate, formatXOF } from "@/lib/format";
import { SupplierModal } from "./PurchaseModals";

export default function SupplierDetail({ id }: { id: string }) {
  const { db, today } = useDemo();
  const router = useRouter();
  const edit = useModal();
  const [pay, setPay] = useState<BillState | null>(null);
  const [newBill, setNewBill] = useState(false);
  const s = db.suppliers.find((x) => x.id === id);
  if (!s) return <p className="text-sm text-gray-500">Fournisseur introuvable.</p>;
  const pos = db.purchaseOrders.filter((p) => p.supplierId === s.id);
  const bills = (db.bills ?? []).filter((b) => b.supplierId === s.id && b.status !== "annulee").map((b) => billState(db, b, today)).sort((a, b) => Number(b.bill.status === "ouverte") - Number(a.bill.status === "ouverte") || a.bill.dueDate.localeCompare(b.bill.dueDate));
  const debt = debtsBySupplier(db, today).find((x) => x.supplier.id === s.id);
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
            { label: "Type", value: s.kind === "prestataire" ? "Prestataire de services" : "Fournisseur" },
            { label: "Catégorie", value: s.category },
            { label: "Contact", value: s.contactName },
            { label: "Téléphone", value: s.phone },
            { label: "E-mail", value: s.email },
            { label: "Conditions", value: s.paymentTerms },
            { label: "Statut", value: <StatusBadge kind="supplier" value={s.status} /> },
            { label: "NCC", value: s.ncc },
            { label: "RCCM", value: s.rccm },
            { label: "Localisation", value: s.location },
            { label: "Adresse", value: s.address, wide: true },
            { label: "GPS", value: s.gps },
          ]}
        />
        {(s.intermediaries ?? []).length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-800">
            <p className="mb-2 text-theme-xs font-medium tracking-wide text-gray-500 uppercase">Intermédiaires</p>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {s.intermediaries!.map((m) => (
                <li key={m.id} className="rounded-xl bg-gray-50 px-3 py-2 text-sm dark:bg-white/5">
                  <p className="font-medium text-gray-800 dark:text-white/90">{m.name} <span className="font-normal text-gray-500">· {m.role}{m.company ? ` · ${m.company}` : ""}</span></p>
                  <p className="text-theme-xs text-gray-600 select-all dark:text-gray-400">{m.phone}{m.email ? ` · ${m.email}` : ""}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </ComponentCard>
      <ComponentCard
        title="Dettes et paiements"
        desc={debt ? `Reste à payer ${formatXOF(debt.remaining)}${debt.overdue ? ` · dont ${formatXOF(debt.overdue)} échus` : ""}${debt.payableNow ? ` · ${formatXOF(debt.payableNow)} couverts par les ventes` : ""}` : "Aucune dette en cours."}
        actions={<Button size="sm" variant="outline" startIcon={<PlusIcon />} onClick={() => setNewBill(true)}>Nouvelle dette</Button>}
      >
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {bills.map((b) => <BillItem key={b.bill.id} s={b} onPay={setPay} showSupplier={false} />)}
        </ul>
        {!bills.length && <p className="text-sm text-gray-500">Aucune facture enregistrée pour ce {s.kind === "prestataire" ? "prestataire" : "fournisseur"}.</p>}
      </ComponentCard>
      <PayBillModal state={pay} onClose={() => setPay(null)} />
      <BillFormModal isOpen={newBill} onClose={() => setNewBill(false)} supplierId={s.id} />
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
