"use client";

import AppModal from "@/components/common/AppModal";
import DemoNotice from "@/components/common/DemoNotice";
import StatusBadge from "@/components/common/StatusBadge";
import { FormGrid, NumberField, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useOptions } from "@/hooks/useOptions";
import { lotBlockReason, pickLotsFEFO, productName } from "@/lib/calc";
import { formatDate, uid } from "@/lib/format";
import { createPrescription, deliverPrescription, remaining, type PrescriptionInput } from "@/lib/services/prescriptionsService";
import type { Prescription } from "@/lib/types";
import { cn } from "@/utils";
import { useEffect, useMemo, useState } from "react";

export function PrescriptionModal({ isOpen, onClose, patientId, consultationId, hospitalizationId }: { isOpen: boolean; onClose: () => void; patientId: string; consultationId?: string; hospitalizationId?: string }) {
  const { run, user, db } = useDemo();
  const opts = useOptions();
  const empty: PrescriptionInput = { patientId, consultationId, hospitalizationId, productId: "", form: "", route: "", quantity: 1, dose: "", frequency: "", duration: "", instructions: "", vetId: user && ["dg", "vet"].includes(user.roleId) ? user.id : "" };
  const [v, setV] = useState<PrescriptionInput>(empty);
  useEffect(() => {
    if (isOpen) setV(empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
  const set = <K extends keyof PrescriptionInput>(k: K, x: PrescriptionInput[K]) => setV((s) => ({ ...s, [k]: x }));
  const product = db.products.find((p) => p.id === v.productId);
  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title="Nouvelle prescription"
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button size="sm" onClick={() => run(createPrescription, v).ok && onClose()} disabled={!v.productId || !v.dose.trim() || !(v.quantity > 0) || !v.vetId}>
            Enregistrer (brouillon)
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <DemoNotice>La prescription seule ne modifie jamais le stock. Dose, fréquence et durée sont saisies par le professionnel (aucune valeur proposée automatiquement).</DemoNotice>
        <FormGrid>
          <SelectField label="Produit / médicament" required value={v.productId} onChange={(x) => { const p = db.products.find((y) => y.id === x); setV({ ...v, productId: x, form: p?.form ?? "" }); }} options={opts.products} className="sm:col-span-2" />
          <TextField label="Forme" value={v.form} onChange={(x) => set("form", x)} />
          <TextField label="Voie d'administration" value={v.route} onChange={(x) => set("route", x)} />
          <NumberField label={`Quantité prescrite${product ? ` (${product.saleUnit})` : ""}`} required value={v.quantity} onChange={(x) => set("quantity", x)} min={1} />
          <TextField label="Dose (saisie professionnelle)" required value={v.dose} onChange={(x) => set("dose", x)} />
          <TextField label="Fréquence" value={v.frequency} onChange={(x) => set("frequency", x)} />
          <TextField label="Durée" value={v.duration} onChange={(x) => set("duration", x)} />
          <SelectField label="Responsable clinique" required value={v.vetId} onChange={(x) => set("vetId", x)} options={opts.vets} />
          <TextField label="Auteur" value={user?.name ?? ""} onChange={() => undefined} disabled />
          <TextAreaField label="Consignes" value={v.instructions} onChange={(x) => set("instructions", x)} rows={2} className="sm:col-span-2" />
        </FormGrid>
      </div>
    </AppModal>
  );
}

/** Délivrance confirmée : FEFO par défaut, lots périmés / en quarantaine affichés mais bloqués. */
export function DeliveryModal({ prescription, onClose }: { prescription: Prescription | null; onClose: () => void }) {
  const { db, run, today, establishment } = useDemo();
  const [qty, setQty] = useState(1);
  const [lotId, setLotId] = useState("");
  const [kind, setKind] = useState<"delivrance" | "administration">("delivrance");
  const [opKey, setOpKey] = useState("");
  useEffect(() => {
    if (prescription) {
      setQty(remaining(prescription));
      setLotId("");
      setKind("delivrance");
      setOpKey(uid("dl-op"));
    }
  }, [prescription]);
  const lots = useMemo(() => (prescription ? db.lots.filter((l) => l.productId === prescription.productId && l.establishmentId === establishment?.id && (l.qtyAvailable > 0 || l.status !== "perime")).sort((a, b) => a.expiryDate.localeCompare(b.expiryDate)) : []), [db, prescription, establishment]);
  if (!prescription) return null;
  const fefo = pickLotsFEFO(db, prescription.productId, establishment?.id ?? "", qty || 0, today);
  const rest = remaining(prescription);

  return (
    <AppModal
      isOpen={!!prescription}
      onClose={onClose}
      size="lg"
      title={`Délivrance — ${prescription.code}`}
      description={`${productName(db, prescription.productId)} · prescrit ${prescription.quantity} · reste ${rest}`}
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button size="sm" onClick={() => run(deliverPrescription, { id: prescription.id, qty, lotId: lotId || undefined, opKey, kind }).ok && onClose()} disabled={!(qty > 0) || qty > rest}>
            Confirmer la {kind === "delivrance" ? "délivrance" : "administration"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormGrid>
          <NumberField label="Quantité à délivrer" required value={qty} onChange={setQty} min={1} max={rest} hint={`Délivrance partielle possible — reliquat conservé (max ${rest}).`} />
          <SelectField label="Type d'opération" value={kind} onChange={(x) => setKind(x as typeof kind)} options={[{ value: "delivrance", label: "Délivrance au client" }, { value: "administration", label: "Administration en clinique" }]} />
        </FormGrid>
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Choix du lot</p>
          <label className={cn("mb-2 flex cursor-pointer items-start gap-3 rounded-xl border p-3", !lotId ? "border-brand-300 bg-brand-25 dark:border-brand-700 dark:bg-brand-500/10" : "border-gray-200 dark:border-gray-800")}>
            <input type="radio" checked={!lotId} onChange={() => setLotId("")} className="mt-1 text-brand-500" />
            <span className="text-sm">
              <strong>Automatique (FEFO)</strong> — lot utilisable à la péremption la plus proche
              <span className="block text-theme-xs text-gray-500">{fefo.ok ? fefo.allocations.map((a) => `${db.lots.find((l) => l.id === a.lotId)?.ref} × ${a.qty}`).join(", ") : fefo.error}</span>
            </span>
          </label>
          <ul className="space-y-2">
            {lots.map((l) => {
              const block = lotBlockReason(l, today);
              return (
                <li key={l.id}>
                  <label className={cn("flex items-center gap-3 rounded-xl border p-3", block ? "cursor-not-allowed border-gray-100 bg-gray-50 opacity-70 dark:border-gray-800 dark:bg-white/2" : "cursor-pointer", lotId === l.id ? "border-brand-300 bg-brand-25 dark:border-brand-700" : "border-gray-200 dark:border-gray-800")}>
                    <input type="radio" disabled={!!block} checked={lotId === l.id} onChange={() => setLotId(l.id)} className="text-brand-500" />
                    <span className="flex-1 text-sm">
                      <strong>{l.ref}</strong> · péremption {formatDate(l.expiryDate)} · disponible {l.qtyAvailable}
                      {block && <span className="block text-theme-xs text-error-600 dark:text-error-400">{block}</span>}
                    </span>
                    <StatusBadge kind="lot" value={l.expiryDate < today ? "perime" : l.status} />
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
        <DemoNotice>Seule la délivrance (ou l&apos;administration) confirmée crée un mouvement de stock, une seule fois par opération.</DemoNotice>
      </div>
    </AppModal>
  );
}
