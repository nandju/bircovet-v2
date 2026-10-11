"use client";

import AppModal from "@/components/common/AppModal";
import DemoNotice from "@/components/common/DemoNotice";
import { FormGrid, NumberField, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useOptions } from "@/hooks/useOptions";
import { productName } from "@/lib/calc";
import { formatDate } from "@/lib/format";
import { optionsOf } from "@/lib/labels";
import { createProduct, proposeCorrection, setLotStatus, updateProduct, type ProductInput } from "@/lib/services/inventoryService";
import type { LotStatus, Product, StockCorrection, StockLot } from "@/lib/types";
import { useEffect, useState } from "react";

const EMPTY: ProductInput = { name: "", category: "medicament", description: "", purchaseUnit: "Boîte", stockUnit: "Unité", saleUnit: "Unité", conversion: 1, alertThreshold: 5, purchasePrice: 0, salePrice: 0, supplierId: "", status: "actif", form: "" };

export function ProductFormModal({ isOpen, onClose, product, onCreated }: { isOpen: boolean; onClose: () => void; product?: Product; onCreated?: (id: string) => void }) {
  const { run } = useDemo();
  const opts = useOptions();
  const [v, setV] = useState<ProductInput>(EMPTY);
  useEffect(() => {
    if (isOpen) setV(product ? { ...product } : EMPTY);
  }, [isOpen, product]);
  const set = <K extends keyof ProductInput>(k: K, x: ProductInput[K]) => setV((s) => ({ ...s, [k]: x }));
  const save = () => {
    if (product) return run(updateProduct, { id: product.id, patch: v }).ok && onClose();
    const r = run(createProduct, v);
    if (r.ok) {
      onClose();
      if (r.data) onCreated?.(r.data);
    }
  };
  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={product ? `Modifier ${product.code}` : "Nouvel article"}
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button size="sm" onClick={save} disabled={!v.name.trim() || !v.supplierId}>
            Enregistrer
          </Button>
        </>
      }
    >
      <FormGrid cols={3}>
        <TextField label="Nom" required value={v.name} onChange={(x) => set("name", x)} className="sm:col-span-2" />
        <SelectField label="Catégorie" value={v.category} onChange={(x) => set("category", x as ProductInput["category"])} options={optionsOf("category")} />
        <TextField label="Forme" value={v.form} onChange={(x) => set("form", x)} />
        <SelectField label="Fournisseur" required value={v.supplierId} onChange={(x) => set("supplierId", x)} options={opts.suppliers} />
        <SelectField label="Statut" value={v.status} onChange={(x) => set("status", x as ProductInput["status"])} options={optionsOf("product")} />
        <TextField label="Unité d'achat" value={v.purchaseUnit} onChange={(x) => set("purchaseUnit", x)} />
        <TextField label="Unité de stockage" value={v.stockUnit} onChange={(x) => set("stockUnit", x)} />
        <TextField label="Unité de vente" value={v.saleUnit} onChange={(x) => set("saleUnit", x)} />
        <NumberField label="Conversion (unités de stock / unité d'achat)" value={v.conversion} onChange={(x) => set("conversion", x)} min={1} />
        <NumberField label="Seuil d'alerte" value={v.alertThreshold} onChange={(x) => set("alertThreshold", x)} min={0} />
        <div />
        <NumberField label="Prix d'achat (unité d'achat)" suffix="FCFA" value={v.purchasePrice} onChange={(x) => set("purchasePrice", x)} min={0} step={50} />
        <NumberField label="Prix de vente (unité de vente)" suffix="FCFA" value={v.salePrice} onChange={(x) => set("salePrice", x)} min={0} step={50} />
        <div />
        <TextAreaField label="Description" value={v.description} onChange={(x) => set("description", x)} rows={2} className="sm:col-span-3" />
      </FormGrid>
    </AppModal>
  );
}

export function CorrectionModal({ lot, onClose, defaultKind = "correction" }: { lot: StockLot | null; onClose: () => void; defaultKind?: StockCorrection["kind"] }) {
  const { run } = useDemo();
  const [kind, setKind] = useState<StockCorrection["kind"]>(defaultKind);
  const [qty, setQty] = useState(NaN);
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (lot) {
      setKind(defaultKind);
      setQty(NaN);
      setReason("");
    }
  }, [lot, defaultKind]);
  if (!lot) return null;
  const delta = kind === "correction" ? qty : -Math.abs(qty);
  return (
    <AppModal
      isOpen={!!lot}
      onClose={onClose}
      title="Proposer une correction / perte / retour"
      description={`${lot.ref} · disponible ${lot.qtyAvailable}`}
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button size="sm" disabled={!Number.isFinite(qty) || qty === 0 || !reason.trim()} onClick={() => run(proposeCorrection, { lotId: lot.id, qtyDelta: delta, reason, kind }).ok && onClose()}>
            Proposer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <DemoNotice>La proposition n&apos;affecte pas le stock : elle doit être validée par le profil DG. Un stock négatif est toujours refusé.</DemoNotice>
        <FormGrid>
          <SelectField label="Nature" value={kind} onChange={(x) => setKind(x as StockCorrection["kind"])} options={[{ value: "correction", label: "Correction (+/−)" }, { value: "perte", label: "Perte / casse" }, { value: "retour_fournisseur", label: "Retour fournisseur" }]} />
          <NumberField label={kind === "correction" ? "Écart (+ ou −)" : "Quantité sortie"} value={qty} onChange={setQty} />
        </FormGrid>
        <TextAreaField label="Motif" required value={reason} onChange={setReason} rows={2} />
      </div>
    </AppModal>
  );
}

export function LotStatusModal({ lot, onClose }: { lot: StockLot | null; onClose: () => void }) {
  const { run, db } = useDemo();
  const [status, setStatus] = useState<LotStatus>("disponible");
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (lot) {
      setStatus(lot.status === "quarantaine" ? "disponible" : "quarantaine");
      setReason("");
    }
  }, [lot]);
  if (!lot) return null;
  return (
    <AppModal
      isOpen={!!lot}
      onClose={onClose}
      title="Changer le statut du lot"
      description={`${lot.ref} — ${productName(db, lot.productId)} · péremption ${formatDate(lot.expiryDate)}`}
      size="sm"
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button size="sm" disabled={!reason.trim()} onClick={() => run(setLotStatus, { lotId: lot.id, status, reason }).ok && onClose()}>
            Appliquer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <SelectField label="Nouveau statut" value={status} onChange={(x) => setStatus(x as LotStatus)} options={optionsOf("lot")} />
        <TextAreaField label="Motif" required value={reason} onChange={setReason} rows={2} />
      </div>
    </AppModal>
  );
}
