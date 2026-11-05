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
import { createPrescriptionOrder, deliverPrescription, remaining, type OrderLineInput, type PrescriptionInput } from "@/lib/services/prescriptionsService";
import BodyPortal from "@/components/common/BodyPortal";
import { OrderPrint } from "./OrderSheet";
import type { Prescription } from "@/lib/types";
import { cn } from "@/utils";
import { useEffect, useMemo, useState } from "react";

export type RxLine = OrderLineInput;
const EMPTY_LINE: RxLine = { productId: "", form: "", route: "", quantity: 1, dose: "", frequency: "", duration: "", instructions: "" };

/**
 * Ordonnance de un ou plusieurs médicaments (consultation, hospitalisation, calculateur, vente au comptoir).
 * `preset` = un médicament pré-rempli ; `presetLines` = plusieurs.
 */
export function PrescriptionModal({ isOpen, onClose, patientId, clientId, consultationId, hospitalizationId, preset, presetLines, sale, onCreated }: { isOpen: boolean; onClose: () => void; patientId: string; clientId?: string; consultationId?: string; hospitalizationId?: string; preset?: Partial<PrescriptionInput>; presetLines?: Partial<RxLine>[]; sale?: { invoiceId: string }; onCreated?: (orderId: string) => void }) {
  const { run, user, db } = useDemo();
  const opts = useOptions();
  const defaultVet = user && ["dg", "vet"].includes(user.roleId) ? user.id : "";
  const [pid, setPid] = useState(patientId);
  const [vetId, setVetId] = useState(preset?.vetId ?? defaultVet);
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<RxLine[]>([{ ...EMPTY_LINE }]);
  const [printLines, setPrintLines] = useState<Prescription[] | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => {
    if (!isOpen) return;
    setPid(patientId || preset?.patientId || "");
    setVetId(preset?.vetId ?? defaultVet);
    setNote("");
    const base = presetLines?.length ? presetLines : preset ? [preset] : [{}];
    setLines(base.map((l) => {
      const p = db.products.find((x) => x.id === l.productId);
      return { ...EMPTY_LINE, form: p?.form ?? "", ...Object.fromEntries(Object.entries(l).filter(([k]) => k in EMPTY_LINE)) } as RxLine;
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
  const setLine = (i: number, patch: Partial<RxLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const ready = !!pid && !!vetId && lines.length > 0 && lines.every((l) => l.productId && l.dose.trim() && l.quantity > 0);
  const save = (print: boolean) => {
    const r = run(createPrescriptionOrder, { patientId: pid, consultationId, hospitalizationId, vetId, lines, note, sale });
    if (!r.ok || !r.data) return;
    onClose();
    if (print && r.db) {
      setPending(r.data);
      setPrintLines(r.db.prescriptions.filter((x) => x.orderId === r.data).sort((a, b) => (a.lineNo ?? 0) - (b.lineNo ?? 0)));
    } else onCreated?.(r.data);
  };
  const patientOpts = clientId ? opts.patientsOf(clientId) : opts.patientsOf();
  return (
    <BodyPortal>
      <AppModal
        isOpen={isOpen}
        onClose={onClose}
        size="xl"
        title={lines.length > 1 ? `Nouvelle ordonnance · ${lines.length} médicaments` : "Nouvelle ordonnance"}
        description={sale ? "Les médicaments ont déjà été remis à la vente : l'ordonnance ne touche pas au stock." : undefined}
        footer={
          <>
            <Button size="sm" variant="outline" onClick={onClose}>Annuler</Button>
            <Button size="sm" variant="outline" onClick={() => save(true)} disabled={!ready}>Enregistrer et imprimer</Button>
            <Button size="sm" onClick={() => save(false)} disabled={!ready}>{sale ? "Enregistrer l'ordonnance" : "Enregistrer (brouillon)"}</Button>
          </>
        }
      >
        <div className="space-y-4">
          {!sale && <DemoNotice>La prescription seule ne modifie jamais le stock. Dose, fréquence et durée sont saisies par le professionnel (aucune valeur proposée automatiquement).</DemoNotice>}
          <FormGrid>
            {(!patientId || clientId) && <SelectField label="Animal" required value={pid} onChange={setPid} options={patientOpts} />}
            <SelectField label="Responsable clinique" required value={vetId} onChange={setVetId} options={opts.vets} />
          </FormGrid>
          <ol className="space-y-3">
            {lines.map((l, i) => {
              const product = db.products.find((p) => p.id === l.productId);
              return (
                <li key={i} className="rounded-2xl border border-gray-200 p-3 dark:border-gray-800">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-800 dark:text-white/90">Médicament {i + 1}{product?.humanUse ? <span className="ms-2 rounded-full bg-warning-50 px-2 py-0.5 text-[11px] font-medium text-warning-700 dark:bg-warning-500/15 dark:text-warning-300">usage humain</span> : null}</p>
                    {lines.length > 1 && <button type="button" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="rounded-lg px-2 py-1 text-theme-xs font-medium text-error-600 hover:bg-error-50 dark:hover:bg-error-500/10">Retirer</button>}
                  </div>
                  <FormGrid>
                    <SelectField label="Produit / médicament" required value={l.productId} onChange={(x) => { const p = db.products.find((y) => y.id === x); setLine(i, { productId: x, form: p?.form ?? l.form, route: l.route || (p?.routes?.length ? p.routes.join(", ") : "") }); }} options={opts.products} className="sm:col-span-2" />
                    <TextField label="Forme" value={l.form} onChange={(x) => setLine(i, { form: x })} />
                    <TextField label="Voie d'administration" value={l.route} onChange={(x) => setLine(i, { route: x })} />
                    <NumberField label={`Quantité${product ? ` (${product.saleUnit})` : ""}`} required value={l.quantity} onChange={(x) => setLine(i, { quantity: x })} min={1} />
                    <TextField label="Dose (saisie professionnelle)" required value={l.dose} onChange={(x) => setLine(i, { dose: x })} />
                    <TextField label="Fréquence" value={l.frequency} onChange={(x) => setLine(i, { frequency: x })} placeholder="Ex. 2 fois par jour" />
                    <TextField label="Durée" value={l.duration} onChange={(x) => setLine(i, { duration: x })} placeholder="Ex. 7 jours" />
                    <TextAreaField label="Consignes pour ce médicament" value={l.instructions} onChange={(x) => setLine(i, { instructions: x })} rows={2} className="sm:col-span-2" />
                  </FormGrid>
                </li>
              );
            })}
          </ol>
          <Button size="sm" variant="soft" onClick={() => setLines((ls) => [...ls, { ...EMPTY_LINE }])}>Ajouter un médicament</Button>
          <TextAreaField label="Consignes générales (facultatif)" value={note} onChange={setNote} rows={2} placeholder="Ex. revoir dans 7 jours, mettre une collerette…" />
        </div>
      </AppModal>
      <OrderPrint lines={printLines} onClose={() => { setPrintLines(null); if (pending) onCreated?.(pending); setPending(null); }} />
    </BodyPortal>
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
