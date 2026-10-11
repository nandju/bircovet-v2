"use client";

import ComponentCard from "@/components/common/ComponentCard";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import DemoNotice from "@/components/common/DemoNotice";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import StatusBadge from "@/components/common/StatusBadge";
import { SelectField } from "@/components/form/Field";
import DataTable from "@/components/tables/DataTable";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { lotRef, productName, userName } from "@/lib/calc";
import { formatDate, formatDateTime } from "@/lib/format";
import { decideCorrection } from "@/lib/services/inventoryService";
import type { StockCorrection, StockLot } from "@/lib/types";
import { useState } from "react";
import { CorrectionModal } from "./StockModals";

const KIND: Record<string, string> = { correction: "Correction", perte: "Perte", retour_fournisseur: "Retour fournisseur", inventaire: "Écart d'inventaire" };

export default function CorrectionsPage() {
  const { db, run, user, establishment, can } = useDemo();
  const [lotId, setLotId] = useState("");
  const [lot, setLot] = useState<StockLot | null>(null);
  const [reject, setReject] = useState<StockCorrection | null>(null);
  const isDG = user?.roleId === "dg";
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb pageTitle="Pertes, retours et corrections" trail={[{ label: "Stock", href: "/stock" }]} />
      <DemoNotice>Toute correction, perte ou retour fournisseur est d&apos;abord proposé, puis validé ou rejeté par le DG. Le décideur et la date sont tracés au journal.</DemoNotice>
      {can("stock", "update") && (
        <ComponentCard title="Nouvelle proposition">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <SelectField label="Lot concerné" value={lotId} onChange={setLotId} options={db.lots.filter((l) => l.establishmentId === establishment?.id && l.qtyAvailable > 0).map((l) => ({ value: l.id, label: `${productName(db, l.productId)} — ${l.ref} (dispo ${l.qtyAvailable}, pér. ${formatDate(l.expiryDate)})` }))} className="flex-1" />
            <Button disabled={!lotId} onClick={() => setLot(db.lots.find((l) => l.id === lotId) ?? null)}>
              Proposer…
            </Button>
          </div>
        </ComponentCard>
      )}
      <ComponentCard title="Propositions et décisions">
        <DataTable
          rows={db.corrections}
          rowKey={(c) => c.id}
          initialSort={{ key: "d", dir: "desc" }}
          emptyTitle="Aucune proposition"
          columns={[
            { key: "d", header: "Date", primary: true, sortValue: (c) => c.date, render: (c) => formatDateTime(c.date) },
            { key: "k", header: "Nature", render: (c) => KIND[c.kind] },
            { key: "p", header: "Article / lot", render: (c) => `${productName(db, c.productId)} — ${lotRef(db, c.lotId)}` },
            { key: "q", header: "Écart", align: "end", render: (c) => <span className={c.qtyDelta > 0 ? "text-success-600" : "text-error-600"}>{c.qtyDelta > 0 ? `+${c.qtyDelta}` : c.qtyDelta}</span> },
            { key: "r", header: "Motif", render: (c) => c.reason },
            { key: "u", header: "Demandé par", hideOnMobile: true, render: (c) => userName(db, c.requestedById) },
            { key: "s", header: "Statut", render: (c) => <span className="flex flex-col gap-0.5"><StatusBadge kind="correction" value={c.status} />{c.decidedById && <span className="text-[11px] text-gray-500">{userName(db, c.decidedById)}</span>}</span> },
            {
              key: "a",
              header: "Décision",
              render: (c) =>
                c.status === "proposee" && isDG && !c.inventoryId ? (
                  <span className="flex gap-1">
                    <Button size="xs" onClick={() => run(decideCorrection, { id: c.id, approve: true })}>
                      Valider
                    </Button>
                    <Button size="xs" variant="ghost" className="text-error-600" onClick={() => setReject(c)}>
                      Rejeter
                    </Button>
                  </span>
                ) : c.status === "proposee" ? (
                  <span className="text-theme-xs text-gray-500">{c.inventoryId ? "Via l'inventaire" : "En attente DG"}</span>
                ) : null,
            },
          ]}
        />
      </ComponentCard>
      <CorrectionModal lot={lot} onClose={() => { setLot(null); setLotId(""); }} />
      <ConfirmDialog isOpen={!!reject} onClose={() => setReject(null)} title="Rejeter la proposition" message="Aucun mouvement de stock ne sera créé." reasonLabel="Motif du rejet" onConfirm={(note) => (reject ? run(decideCorrection, { id: reject.id, approve: false, note }).ok : false)} />
    </div>
  );
}
