"use client";

import AppModal from "@/components/common/AppModal";
import { FormGrid, NumberField, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useOptions } from "@/hooks/useOptions";
import { patientName } from "@/lib/calc";
import { createTreatment, type TreatmentInput } from "@/lib/services/treatmentsService";
import { SLOT_PRESETS } from "@/lib/treatments";
import { useEffect, useState } from "react";

const ROUTES = ["Voie orale", "Sous-cutanée", "Intramusculaire", "Intraveineuse", "Cutanée / locale", "Auriculaire", "Oculaire", "Dans l'eau de boisson", "Dans l'aliment"].map((r) => ({ value: r, label: r }));

export default function TreatmentFormModal({ isOpen, onClose, preset }: { isOpen: boolean; onClose: () => void; preset?: Partial<TreatmentInput> }) {
  const { db, run, today, user } = useDemo();
  const opts = useOptions();
  const blank = (): TreatmentInput => ({ patientId: "", setting: "domicile", label: "", dose: "", route: "Voie orale", slots: SLOT_PRESETS[2], startDate: today, days: 5, vetId: user?.roleId === "vet" || user?.roleId === "dg" ? user.id : "", instructions: "", ...preset });
  const [v, setV] = useState<TreatmentInput>(blank);
  const [perDay, setPerDay] = useState(2);
  useEffect(() => {
    if (!isOpen) return;
    const b = blank();
    setV(b);
    setPerDay(b.slots.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- réinitialisation à l'ouverture
  }, [isOpen]);
  const set = <K extends keyof TreatmentInput>(k: K, x: TreatmentInput[K]) => setV((s) => ({ ...s, [k]: x }));
  const stays = db.hospitalizations.filter((h) => h.status === "en_cours" && (!v.patientId || h.patientId === v.patientId));
  const product = db.products.find((p) => p.id === v.productId);
  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title="Mettre en place un traitement suivi"
      description="Chaque prise sera cochée par l'équipe (clinique) ou confirmée par le propriétaire (domicile)."
      footer={<><Button size="sm" variant="outline" onClick={onClose}>Annuler</Button><Button size="sm" onClick={() => run(createTreatment, { ...v, label: v.label || product?.name || "" }).ok && onClose()}>Mettre en place</Button></>}
    >
      <div className="mb-4 grid grid-cols-2 gap-2">
        {(["hospitalisation", "domicile"] as const).map((k) => (
          <button key={k} type="button" aria-pressed={v.setting === k} onClick={() => set("setting", k)} className={`cliva-press rounded-xl border px-3 py-2.5 text-start ${v.setting === k ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10" : "border-gray-200 dark:border-gray-700"}`}>
            <span className="block text-sm font-semibold text-gray-800 dark:text-white/90">{k === "hospitalisation" ? "En hospitalisation" : "À domicile"}</span>
            <span className="block text-theme-xs text-gray-500">{k === "hospitalisation" ? "Les assistants cochent chaque prise" : "Le propriétaire confirme (appel, WhatsApp…)"}</span>
          </button>
        ))}
      </div>
      <FormGrid>
        <SelectField label="Patient" required value={v.patientId} onChange={(x) => setV((s) => ({ ...s, patientId: x, hospitalizationId: db.hospitalizations.find((h) => h.status === "en_cours" && h.patientId === x)?.id }))} options={opts.patientsOf()} />
        {v.setting === "hospitalisation" ? (
          <SelectField label="Séjour" required value={v.hospitalizationId ?? ""} onChange={(x) => set("hospitalizationId", x)} options={stays.map((h) => ({ value: h.id, label: `${h.code} — ${patientName(db, h.patientId)} (${h.cage})` }))} />
        ) : (
          <SelectField label="Suivi par (relances)" value={v.responsibleId ?? ""} onChange={(x) => set("responsibleId", x || undefined)} options={opts.users} allowEmpty placeholder="—" />
        )}
        <SelectField label="Produit du stock (facultatif)" value={v.productId ?? ""} onChange={(x) => set("productId", x || undefined)} options={opts.products} allowEmpty placeholder="Aucun" />
        <TextField label="Médicament ou soin" value={v.label} onChange={(x) => set("label", x)} placeholder={product?.name ?? "Ex. : amoxicilline + acide clavulanique"} />
        <TextField label="Dose par prise" required value={v.dose} onChange={(x) => set("dose", x)} placeholder="Ex. : 1 comprimé de 250 mg" />
        <SelectField label="Voie" value={v.route} onChange={(x) => set("route", x)} options={ROUTES} />
        <SelectField label="Prises par jour" value={String(perDay)} onChange={(x) => { const n = Number(x); setPerDay(n); set("slots", SLOT_PRESETS[n]); }} options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: `${n} fois` }))} />
        <TextField label="Horaires (modifiables)" value={v.slots.join(", ")} onChange={(x) => set("slots", x.split(/[,; ]+/).map((s) => s.trim()).filter((s) => /^\d{1,2}:\d{2}$/.test(s)).map((s) => s.padStart(5, "0")))} placeholder="08:00, 20:00" />
        <TextField label="Début" type="date" value={v.startDate} onChange={(x) => set("startDate", x)} />
        <NumberField label="Durée (jours)" value={v.days} onChange={(x) => set("days", x)} min={1} max={120} />
        <SelectField label="Vétérinaire prescripteur" required value={v.vetId} onChange={(x) => set("vetId", x)} options={opts.vets} />
        <TextAreaField label="Consignes" value={v.instructions ?? ""} onChange={(x) => set("instructions", x)} rows={2} className="sm:col-span-2" />
      </FormGrid>
    </AppModal>
  );
}
