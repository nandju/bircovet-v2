"use client";

import ComponentCard from "@/components/common/ComponentCard";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { FormGrid, NumberField, SelectField } from "@/components/form/Field";
import DataTable from "@/components/tables/DataTable";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useOptions } from "@/hooks/useOptions";
import { establishmentName, lotBlockReason, lotRef, productName, userName } from "@/lib/calc";
import { formatDate, formatDateTime } from "@/lib/format";
import { transferStock } from "@/lib/services/inventoryService";
import { useState } from "react";

export default function TransfersPage() {
  const { db, run, establishment, today, can } = useDemo();
  const opts = useOptions();
  const [v, setV] = useState({ lotId: "", to: "", qty: 1, location: "" });
  const lots = db.lots.filter((l) => l.establishmentId === establishment?.id && !lotBlockReason(l, today));
  const dest = db.establishments.find((e) => e.id === v.to);
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb pageTitle="Transferts entre établissements" trail={[{ label: "Stock", href: "/stock" }]} />
      {can("stock", "update") && (
        <ComponentCard title={`Nouveau transfert depuis ${establishment?.name}`}>
          <FormGrid cols={3}>
            <SelectField label="Lot" required value={v.lotId} onChange={(lotId) => setV({ ...v, lotId })} options={lots.map((l) => ({ value: l.id, label: `${productName(db, l.productId)} — ${l.ref} (dispo ${l.qtyAvailable}, pér. ${formatDate(l.expiryDate)})` }))} className="sm:col-span-2" />
            <NumberField label="Quantité" required value={v.qty} onChange={(qty) => setV({ ...v, qty })} min={1} />
            <SelectField label="Destination" required value={v.to} onChange={(to) => setV({ ...v, to, location: db.establishments.find((e) => e.id === to)?.locations[0] ?? "" })} options={opts.establishments.filter((e) => e.value !== establishment?.id)} />
            <SelectField label="Emplacement de destination" value={v.location} onChange={(location) => setV({ ...v, location })} options={(dest?.locations ?? []).map((l) => ({ value: l, label: l }))} />
            <div className="flex items-end">
              <Button className="w-full" disabled={!v.lotId || !v.to || !(v.qty > 0)} onClick={() => run(transferStock, { lotId: v.lotId, toEstablishmentId: v.to, qty: v.qty, location: v.location }).ok && setV({ lotId: "", to: "", qty: 1, location: "" })}>
                Transférer
              </Button>
            </div>
          </FormGrid>
          <p className="text-theme-xs text-gray-500">Un transfert crée un mouvement sortant et un mouvement entrant liés (même référence de lot). Les lots périmés ou en quarantaine ne sont pas transférables.</p>
        </ComponentCard>
      )}
      <ComponentCard title="Historique des transferts">
        <DataTable
          rows={db.stockTransfers}
          rowKey={(t) => t.id}
          emptyTitle="Aucun transfert"
          columns={[
            { key: "c", header: "Réf.", primary: true, render: (t) => t.code },
            { key: "d", header: "Date", render: (t) => formatDateTime(t.date) },
            { key: "p", header: "Article / lot", render: (t) => `${productName(db, db.lots.find((l) => l.id === t.lotId)?.productId)} — ${lotRef(db, t.lotId)}` },
            { key: "f", header: "De → vers", render: (t) => `${establishmentName(db, t.fromEstablishmentId).replace("Cliva ", "")} → ${establishmentName(db, t.toEstablishmentId).replace("Cliva ", "")}` },
            { key: "q", header: "Qté", align: "end", render: (t) => t.qty },
            { key: "u", header: "Par", render: (t) => userName(db, t.userId) },
          ]}
        />
      </ComponentCard>
    </div>
  );
}
