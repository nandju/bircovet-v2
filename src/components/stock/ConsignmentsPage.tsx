"use client";

import AppModal from "@/components/common/AppModal";
import Can from "@/components/common/Can";
import ComponentCard from "@/components/common/ComponentCard";
import DemoNotice from "@/components/common/DemoNotice";
import FilterBar from "@/components/common/FilterBar";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Panel from "@/components/common/Panel";
import StatusBadge from "@/components/common/StatusBadge";
import { FormGrid, NumberField, SelectField, TextField } from "@/components/form/Field";
import DataTable from "@/components/tables/DataTable";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useModal } from "@/hooks/useModal";
import { useOptions } from "@/hooks/useOptions";
import { PlusIcon } from "@/icons";
import { clientName, productName } from "@/lib/calc";
import { formatDate, formatXOF } from "@/lib/format";
import { labelOf, optionsOf } from "@/lib/labels";
import { createConsignment, setConsignmentStatus } from "@/lib/services/consignmentsService";
import type { ConsignmentStatus } from "@/lib/types";
import { useMemo, useState } from "react";

const NEXT: Record<ConsignmentStatus, { value: ConsignmentStatus; label: string }[]> = {
  en_depot: [
    { value: "en_tresorerie", label: "→ Trésorerie" },
    { value: "a_credit", label: "→ À crédit" },
    { value: "solde", label: "Soldé" },
    { value: "retourne", label: "Retourné" },
  ],
  en_tresorerie: [
    { value: "a_credit", label: "→ À crédit" },
    { value: "solde", label: "Soldé" },
    { value: "retourne", label: "Retourné" },
  ],
  a_credit: [
    { value: "solde", label: "Soldé" },
    { value: "retourne", label: "Retourné" },
  ],
  solde: [],
  retourne: [],
};

/** Suivi des produits en dépôt-vente — jamais assimilés automatiquement à une vente encaissée. */
export default function ConsignmentsPage() {
  const { db, run, can } = useDemo();
  const opts = useOptions();
  const create = useModal();
  const [f, setF] = useState<Record<string, string>>({});
  const [v, setV] = useState({ clientId: "", productId: "", qty: NaN, unitPrice: NaN, note: "" });
  const rows = useMemo(() => db.consignments.filter((c) => !f.status || c.status === f.status), [db, f]);

  return (
    <div className="space-y-4">
      <PageBreadcrumb
        pageTitle="Dépôts-vente"
        subtitle="Produits confiés — suivis distinctement des ventes encaissées"
        trail={[{ label: "Stock", href: "/stock" }]}
        actions={
          <Can module="stock" action="create">
            <Button size="sm" startIcon={<PlusIcon />} onClick={() => { setV({ clientId: "", productId: "", qty: NaN, unitPrice: NaN, note: "" }); create.openModal(); }}>
              Nouveau dépôt
            </Button>
          </Can>
        }
      />
      <DemoNotice>
        Un produit en dépôt-vente n&apos;est ni vendu ni encaissé : sa situation (pharmacie, trésorerie, crédit) est suivie jusqu&apos;au règlement ou au retour. En production, la vente effective sera liée à une facture — le lien reste manuel dans cette démonstration.
      </DemoNotice>
      <Panel>
        <FilterBar values={f} onChange={(k, val) => setF((s) => ({ ...s, [k]: val }))} filters={[{ key: "status", label: "Toutes situations", options: optionsOf("consignment") }]} />
        <DataTable
          rows={rows}
          rowKey={(c) => c.id}
          initialSort={{ key: "d", dir: "desc" }}
          columns={[
            { key: "c", header: "Réf.", primary: true, render: (c) => <span className="font-medium">{c.code}</span> },
            { key: "d", header: "Date", sortValue: (c) => c.date, render: (c) => formatDate(c.date) },
            { key: "cl", header: "Client", render: (c) => clientName(db, c.clientId) },
            { key: "p", header: "Produit", render: (c) => `${productName(db, c.productId)} × ${c.qty}`, hideOnMobile: true },
            { key: "m", header: "Valeur", align: "end", render: (c) => formatXOF(c.qty * c.unitPrice) },
            { key: "s", header: "Situation", render: (c) => <StatusBadge kind="consignment" value={c.status} /> },
            {
              key: "x",
              header: "Suivi",
              render: (c) => (
                <span className="flex flex-wrap gap-1">
                  {NEXT[c.status].map((n) => (
                    <Button key={n.value} size="xs" variant="outline" disabled={!can("stock", "update")} onClick={() => run(setConsignmentStatus, { id: c.id, status: n.value })}>
                      {n.label}
                    </Button>
                  ))}
                </span>
              ),
            },
          ]}
          emptyTitle="Aucun dépôt-vente"
        />
      </Panel>
      <ComponentCard title="Historique récent">
        <ul className="space-y-1.5 text-sm">
          {db.consignments.flatMap((c) => c.history.map((h, i) => (
            <li key={`${c.id}-${i}`} className="text-gray-600 dark:text-gray-400">
              <span className="text-theme-xs text-gray-400">{formatDate(h.date)}</span> — <strong>{c.code}</strong> · {h.action}{h.note ? ` — ${h.note}` : ""}
            </li>
          )))}
          {!db.consignments.length && <li className="text-gray-500">Aucun historique.</li>}
        </ul>
      </ComponentCard>
      <AppModal
        isOpen={create.isOpen}
        onClose={create.closeModal}
        title="Nouveau dépôt-vente"
        footer={
          <>
            <Button size="sm" variant="outline" onClick={create.closeModal}>Annuler</Button>
            <Button size="sm" disabled={!v.clientId || !v.productId || !(v.qty > 0)} onClick={() => run(createConsignment, { ...v, qty: v.qty || 0, unitPrice: v.unitPrice || 0 }).ok && create.closeModal()}>Enregistrer</Button>
          </>
        }
      >
        <FormGrid>
          <SelectField label="Client (dépositaire)" required value={v.clientId} onChange={(clientId) => setV({ ...v, clientId })} options={opts.clients} allowEmpty placeholder="Sélectionner" />
          <SelectField label="Produit" required value={v.productId} onChange={(productId) => { const p = db.products.find((x) => x.id === productId); setV({ ...v, productId, unitPrice: p?.salePrice ?? v.unitPrice }); }} options={db.products.filter((p) => p.status === "actif").map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))} allowEmpty placeholder="Sélectionner" />
          <NumberField label="Quantité" required value={v.qty} onChange={(qty) => setV({ ...v, qty })} min={1} />
          <NumberField label="Prix unitaire convenu" suffix="FCFA" value={v.unitPrice} onChange={(unitPrice) => setV({ ...v, unitPrice })} min={0} step={100} />
          <TextField label="Note" value={v.note} onChange={(note) => setV({ ...v, note })} className="sm:col-span-2" placeholder="Conditions du dépôt, échéance de règlement…" />
        </FormGrid>
        <p className="mt-3 text-theme-xs text-gray-400">{labelOf("consignment", "en_depot")} par défaut — le dépôt ne modifie pas les soldes de stock vendable dans cette démonstration.</p>
      </AppModal>
    </div>
  );
}
