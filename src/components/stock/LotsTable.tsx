"use client";

import StatusBadge from "@/components/common/StatusBadge";
import DataTable from "@/components/tables/DataTable";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { daysBetween, formatDate, formatXOF } from "@/lib/format";
import { establishmentName, productName, supplierName } from "@/lib/calc";
import type { StockLot } from "@/lib/types";
import { useState } from "react";
import { CorrectionModal, LotStatusModal } from "./StockModals";

export default function LotsTable({ rows, showProduct = true }: { rows: StockLot[]; showProduct?: boolean }) {
  const { db, today, can } = useDemo();
  const [statusLot, setStatusLot] = useState<StockLot | null>(null);
  const [corLot, setCorLot] = useState<StockLot | null>(null);
  return (
    <>
      <DataTable
        rows={rows}
        rowKey={(l) => l.id}
        initialSort={{ key: "e", dir: "asc" }}
        emptyTitle="Aucun lot"
        rowClassName={(l) => (l.status === "perime" || l.expiryDate < today ? "bg-error-25/60 dark:bg-error-500/5" : l.status === "quarantaine" ? "bg-warning-25/60 dark:bg-warning-500/5" : "")}
        columns={[
          { key: "r", header: "Lot", primary: true, sortValue: (l) => l.ref, render: (l) => <span className="flex flex-col"><span className="font-medium">{l.ref}</span>{showProduct && <span className="text-theme-xs text-gray-500">{productName(db, l.productId)}</span>}</span> },
          { key: "est", header: "Établissement / emplacement", hideOnMobile: true, render: (l) => `${establishmentName(db, l.establishmentId).replace("Cliva ", "")} · ${l.location}` },
          { key: "f", header: "Fournisseur", hideOnMobile: true, render: (l) => supplierName(db, l.supplierId) },
          { key: "rc", header: "Réception", render: (l) => formatDate(l.receivedAt), hideOnMobile: true },
          { key: "e", header: "Péremption", sortValue: (l) => l.expiryDate, render: (l) => { const d = daysBetween(today, l.expiryDate); return <span className={d < 0 ? "font-medium text-error-600" : d <= db.settings.expiryAlertDays ? "font-medium text-warning-600" : ""}>{formatDate(l.expiryDate)} {d < 0 ? "(périmé)" : d <= db.settings.expiryAlertDays ? `(${d} j)` : ""}</span>; } },
          { key: "q", header: "Reçu / disponible", align: "end", sortValue: (l) => l.qtyAvailable, render: (l) => `${l.qtyReceived} / ${l.qtyAvailable}` },
          { key: "c", header: "Coût unit.", align: "end", hideOnMobile: true, render: (l) => formatXOF(l.unitCost) },
          { key: "s", header: "Statut", render: (l) => <StatusBadge kind="lot" value={l.expiryDate < today ? "perime" : l.status} /> },
          {
            key: "a",
            header: "Actions",
            render: (l) =>
              can("stock", "update") ? (
                <span className="flex gap-1">
                  <Button size="xs" variant="ghost" onClick={() => setStatusLot(l)}>
                    Statut
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => setCorLot(l)} disabled={l.qtyAvailable === 0 && l.status === "perime"}>
                    Correction
                  </Button>
                </span>
              ) : null,
          },
        ]}
      />
      <LotStatusModal lot={statusLot} onClose={() => setStatusLot(null)} />
      <CorrectionModal lot={corLot} onClose={() => setCorLot(null)} />
    </>
  );
}
