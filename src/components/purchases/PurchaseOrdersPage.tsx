"use client";

import Can from "@/components/common/Can";
import ComponentCard from "@/components/common/ComponentCard";
import FilterBar from "@/components/common/FilterBar";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Panel from "@/components/common/Panel";
import StatusBadge from "@/components/common/StatusBadge";
import { TextAreaField } from "@/components/form/Field";
import DataTable from "@/components/tables/DataTable";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useModal } from "@/hooks/useModal";
import { useOptions } from "@/hooks/useOptions";
import { useQueryParam } from "@/hooks/useQueryFlag";
import { useRouter } from "@/i18n/navigation";
import { PlusIcon } from "@/icons";
import { productName, supplierName, userName } from "@/lib/calc";
import { formatDate, formatDateTime, formatXOF } from "@/lib/format";
import { optionsOf } from "@/lib/labels";
import { saveOrderReview } from "@/lib/services/suppliersService";
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
      <MonthlyReview />
    </div>
  );
}

/** Consultation par mois : volumes commandés, produits les plus demandés, commentaires de prévision. */
function MonthlyReview() {
  const { db, run, can, today } = useDemo();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [comment, setComment] = useState("");
  const pos = db.purchaseOrders.filter((p) => p.date.startsWith(month) && p.status !== "annulee");
  const total = pos.reduce((s, p) => s + p.lines.reduce((x, l) => x + l.qtyOrdered * l.unitPrice, 0), 0);
  const acc = new Map<string, number>();
  for (const p of pos) for (const l of p.lines) acc.set(l.productId, (acc.get(l.productId) ?? 0) + l.qtyOrdered);
  const top = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const reviews = db.orderReviews.filter((r) => r.month === month).sort((a, b) => b.date.localeCompare(a.date));
  return (
    <ComponentCard
      title="Revue mensuelle des commandes"
      desc="Indicateurs calculés sur les commandes du mois — utiles aux prévisions"
      actions={<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-9 rounded-lg border border-gray-300 bg-transparent px-2 text-sm dark:border-gray-700" />}
      className="mt-4"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl bg-gray-50 p-3 dark:bg-white/3">
          <p className="text-theme-xs text-gray-500">Commandes du mois</p>
          <p className="text-xl font-semibold text-gray-800 dark:text-white/90">{pos.length}</p>
          <p className="text-theme-xs text-gray-500">{formatXOF(total)} au total</p>
        </div>
        <div className="md:col-span-2">
          <p className="mb-1.5 text-theme-xs font-medium text-gray-500">Produits les plus commandés</p>
          <ul className="space-y-1 text-sm">
            {top.map(([pid, q]) => <li key={pid} className="flex justify-between"><span>{productName(db, pid)}</span><span className="font-medium">{q} u.</span></li>)}
            {!top.length && <li className="text-gray-500">Aucune ligne sur ce mois.</li>}
          </ul>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {reviews.map((r) => (
          <p key={r.id} className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:bg-white/3 dark:text-gray-300">
            {r.comment} <span className="text-theme-xs text-gray-400">— {userName(db, r.userId)}, {formatDateTime(r.date)}</span>
          </p>
        ))}
        {can("achats", "create") && (
          <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (run(saveOrderReview, { month, comment }).ok) setComment(""); }}>
            <TextAreaField label="Commentaire du mois (tendances, prévisions…)" value={comment} onChange={setComment} rows={2} className="flex-1" />
            <Button size="sm" type="submit" disabled={!comment.trim()}>Noter</Button>
          </form>
        )}
      </div>
    </ComponentCard>
  );
}
