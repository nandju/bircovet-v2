"use client";

import AppModal from "@/components/common/AppModal";
import DemoNotice from "@/components/common/DemoNotice";
import { FormGrid, NumberField, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useOptions } from "@/hooks/useOptions";
import { PlusIcon, TrashBinIcon } from "@/icons";
import { productName } from "@/lib/calc";
import { addDays, formatXOF, uid } from "@/lib/format";
import { optionsOf } from "@/lib/labels";
import { createPurchaseOrder, createReception, createSupplier, receivedForLine, updatePurchaseOrder, updateSupplier, type SupplierInput } from "@/lib/services/suppliersService";
import type { PurchaseOrder, PurchaseOrderLine, ReceptionLine, Supplier } from "@/lib/types";
import { useEffect, useState } from "react";

export function PurchaseOrderModal({ isOpen, onClose, po, onCreated }: { isOpen: boolean; onClose: () => void; po?: PurchaseOrder; onCreated?: (id: string) => void }) {
  const { run, db, today } = useDemo();
  const opts = useOptions();
  const [supplierId, setSupplierId] = useState("");
  const [expected, setExpected] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<PurchaseOrderLine[]>([]);
  useEffect(() => {
    if (!isOpen) return;
    setSupplierId(po?.supplierId ?? "");
    setExpected(po?.expectedDate ?? addDays(today, 7));
    setNotes(po?.notes ?? "");
    setLines(po?.lines.map((l) => ({ ...l })) ?? [{ id: uid("pol"), productId: "", qtyOrdered: 1, unitPrice: 0 }]);
  }, [isOpen, po, today]);
  const setLine = (i: number, patch: Partial<PurchaseOrderLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const save = () => {
    if (po) return run(updatePurchaseOrder, { id: po.id, expectedDate: expected, lines, notes }).ok && onClose();
    const r = run(createPurchaseOrder, { supplierId, expectedDate: expected, lines, notes });
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
      title={po ? `Modifier ${po.code}` : "Nouvelle commande d'achat"}
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button size="sm" onClick={save} disabled={!supplierId || !lines.length}>
            Enregistrer (brouillon)
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormGrid>
          <SelectField label="Fournisseur" required value={supplierId} onChange={setSupplierId} options={opts.suppliers} disabled={!!po} />
          <TextField label="Livraison attendue" type="date" value={expected} onChange={setExpected} />
        </FormGrid>
        <div className="space-y-2">
          {lines.map((l, i) => {
            const p = db.products.find((x) => x.id === l.productId);
            return (
              <div key={l.id} className="grid grid-cols-1 items-end gap-2 rounded-xl border border-gray-100 p-3 sm:grid-cols-[1fr_6rem_8rem_auto] dark:border-gray-800">
                <SelectField label="Article" value={l.productId} onChange={(x) => { const pr = db.products.find((y) => y.id === x); setLine(i, { productId: x, unitPrice: pr ? Math.round(pr.purchasePrice / pr.conversion) : 0 }); }} options={opts.products} />
                <NumberField label={`Qté${p ? ` (${p.stockUnit})` : ""}`} value={l.qtyOrdered} onChange={(x) => setLine(i, { qtyOrdered: x })} min={1} />
                <NumberField label="Prix unit." suffix="F" value={l.unitPrice} onChange={(x) => setLine(i, { unitPrice: x })} min={0} />
                <Button size="sm" variant="ghost" onClick={() => setLines(lines.filter((_, j) => j !== i))} title="Retirer">
                  <TrashBinIcon className="size-4" />
                </Button>
              </div>
            );
          })}
          <div className="flex items-center justify-between">
            <Button size="xs" variant="outline" startIcon={<PlusIcon />} onClick={() => setLines([...lines, { id: uid("pol"), productId: "", qtyOrdered: 1, unitPrice: 0 }])}>
              Ligne
            </Button>
            <span className="text-sm font-semibold">Total : {formatXOF(lines.reduce((s, l) => s + (l.qtyOrdered || 0) * (l.unitPrice || 0), 0))}</span>
          </div>
        </div>
        <TextAreaField label="Notes" value={notes} onChange={setNotes} rows={2} />
      </div>
    </AppModal>
  );
}

/** Réception (proposée) : compare commandé / reçu ; le stock n'augmente qu'à la validation. */
export function ReceptionModal({ po, onClose }: { po: PurchaseOrder | null; onClose: () => void }) {
  const { run, db, today } = useDemo();
  const [ref, setRef] = useState("");
  const [lines, setLines] = useState<ReceptionLine[]>([]);
  useEffect(() => {
    if (!po) return;
    setRef("");
    setLines(
      po.lines.map((l) => {
        const rest = Math.max(0, l.qtyOrdered - receivedForLine(db, l.id));
        return { id: uid("rl"), poLineId: l.id, productId: l.productId, qtyOrdered: rest, qtyReceived: rest, lotRef: "", expiryDate: addDays(today, 365), unitCost: l.unitPrice };
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [po]);
  if (!po) return null;
  const setLine = (i: number, patch: Partial<ReceptionLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <AppModal
      isOpen={!!po}
      onClose={onClose}
      size="xl"
      title={`Réception — ${po.code}`}
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button size="sm" onClick={() => run(createReception, { poId: po.id, supplierId: po.supplierId, deliveryNoteRef: ref, lines, source: "manuel" }).ok && onClose()}>
            Enregistrer la réception proposée
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <DemoNotice>La réception est enregistrée comme « proposée ». Les écarts restent visibles et seules les quantités effectivement reçues entreront en stock après validation.</DemoNotice>
        <TextField label="Référence du bon de livraison (simulé)" value={ref} onChange={setRef} />
        {lines.map((l, i) => {
          const gap = l.qtyReceived - l.qtyOrdered;
          return (
            <div key={l.id} className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
              <p className="mb-2 text-sm font-medium text-gray-800 dark:text-white/90">
                {productName(db, l.productId)} — reste à recevoir : {l.qtyOrdered}
                {gap !== 0 && <span className={`ms-2 rounded-full px-2 py-0.5 text-theme-xs ${gap < 0 ? "bg-warning-50 text-warning-700" : "bg-tertiary-50 text-tertiary-700"}`}>Écart {gap > 0 ? `+${gap}` : gap}</span>}
              </p>
              <FormGrid cols={3}>
                <NumberField label="Quantité reçue" value={l.qtyReceived} onChange={(x) => setLine(i, { qtyReceived: x })} min={0} />
                <TextField label="Référence de lot" value={l.lotRef} onChange={(x) => setLine(i, { lotRef: x })} />
                <TextField label="Péremption" type="date" value={l.expiryDate} onChange={(x) => setLine(i, { expiryDate: x })} />
              </FormGrid>
            </div>
          );
        })}
      </div>
    </AppModal>
  );
}

const EMPTY_SUP: SupplierInput = { name: "", contactName: "", phone: "", email: "", address: "", category: "", paymentTerms: "30 jours", status: "actif" };

export function SupplierModal({ isOpen, onClose, supplier }: { isOpen: boolean; onClose: () => void; supplier?: Supplier }) {
  const { run } = useDemo();
  const [v, setV] = useState<SupplierInput>(EMPTY_SUP);
  useEffect(() => {
    if (isOpen) setV(supplier ? { ...supplier } : EMPTY_SUP);
  }, [isOpen, supplier]);
  const set = <K extends keyof SupplierInput>(k: K, x: SupplierInput[K]) => setV((s) => ({ ...s, [k]: x }));
  const save = () => (supplier ? run(updateSupplier, { id: supplier.id, patch: v }) : run(createSupplier, v)).ok && onClose();
  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title={supplier ? `Modifier ${supplier.name}` : "Nouveau fournisseur"}
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button size="sm" onClick={save} disabled={!v.name.trim()}>
            Enregistrer
          </Button>
        </>
      }
    >
      <FormGrid>
        <TextField label="Raison sociale" required value={v.name} onChange={(x) => set("name", x)} className="sm:col-span-2" />
        <TextField label="Contact" value={v.contactName} onChange={(x) => set("contactName", x)} />
        <TextField label="Téléphone" value={v.phone} onChange={(x) => set("phone", x)} />
        <TextField label="E-mail" value={v.email} onChange={(x) => set("email", x)} />
        <SelectField label="Type" value={v.kind ?? "fournisseur"} onChange={(x) => set("kind", x as SupplierInput["kind"])} options={[{ value: "fournisseur", label: "Fournisseur (stock)" }, { value: "prestataire", label: "Prestataire de services" }]} />
        <TextField label="Catégorie" value={v.category} onChange={(x) => set("category", x)} placeholder="Ex. : médicaments, électricité, maintenance…" />
        <TextField label="Conditions de paiement" value={v.paymentTerms} onChange={(x) => set("paymentTerms", x)} hint="« Comptant », « 30 jours », « 45 jours fin de mois » : l'échéance des dettes en découle." />
        <SelectField label="Statut" value={v.status} onChange={(x) => set("status", x as SupplierInput["status"])} options={optionsOf("supplier")} />
        <TextField label="Adresse" value={v.address} onChange={(x) => set("address", x)} className="sm:col-span-2" />
        <TextField label="NCC (compte contribuable)" value={v.ncc ?? ""} onChange={(x) => set("ncc", x || undefined)} placeholder="Ex. : 1234567 A" />
        <TextField label="RCCM" value={v.rccm ?? ""} onChange={(x) => set("rccm", x || undefined)} placeholder="Ex. : CI-ABJ-2020-B-12345" />
        <TextField label="Localisation" value={v.location ?? ""} onChange={(x) => set("location", x || undefined)} placeholder="Commune, quartier, repère" />
        <TextField label="Coordonnées GPS" value={v.gps ?? ""} onChange={(x) => set("gps", x || undefined)} placeholder="5.3364, -4.0267" />
      </FormGrid>
      <div className="mt-5">
        <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Intermédiaires (délégués, commerciaux, transitaires)</p>
        <div className="space-y-2">
          {(v.intermediaries ?? []).map((m, i) => {
            const upd = (patch: Partial<typeof m>) => set("intermediaries", (v.intermediaries ?? []).map((x, j) => (j === i ? { ...x, ...patch } : x)));
            return (
              <div key={m.id} className="grid grid-cols-2 gap-2 rounded-xl border border-gray-200 p-2 sm:grid-cols-[1.2fr_1fr_1fr_1fr_1.2fr_auto] dark:border-gray-700">
                <input aria-label="Nom" placeholder="Nom" value={m.name} onChange={(e) => upd({ name: e.target.value })} className="h-9 rounded-md border border-gray-200 bg-transparent px-2 text-sm dark:border-gray-700 dark:text-white/90" />
                <input aria-label="Rôle" placeholder="Rôle" value={m.role} onChange={(e) => upd({ role: e.target.value })} className="h-9 rounded-md border border-gray-200 bg-transparent px-2 text-sm dark:border-gray-700 dark:text-white/90" />
                <input aria-label="Société" placeholder="Société" value={m.company ?? ""} onChange={(e) => upd({ company: e.target.value })} className="h-9 rounded-md border border-gray-200 bg-transparent px-2 text-sm dark:border-gray-700 dark:text-white/90" />
                <input aria-label="Téléphone" placeholder="Téléphone" value={m.phone} onChange={(e) => upd({ phone: e.target.value })} className="h-9 rounded-md border border-gray-200 bg-transparent px-2 text-sm dark:border-gray-700 dark:text-white/90" />
                <input aria-label="E-mail" placeholder="E-mail" value={m.email ?? ""} onChange={(e) => upd({ email: e.target.value })} className="h-9 rounded-md border border-gray-200 bg-transparent px-2 text-sm dark:border-gray-700 dark:text-white/90" />
                <button type="button" onClick={() => set("intermediaries", (v.intermediaries ?? []).filter((_, j) => j !== i))} className="text-theme-xs text-gray-400 hover:text-error-600">Retirer</button>
              </div>
            );
          })}
        </div>
        <button type="button" onClick={() => set("intermediaries", [...(v.intermediaries ?? []), { id: `int-${Date.now()}`, name: "", role: "Délégué commercial", phone: "" }])} className="mt-2 text-theme-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
          + Ajouter un intermédiaire
        </button>
      </div>
    </AppModal>
  );
}
