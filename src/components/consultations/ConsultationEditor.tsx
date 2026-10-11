"use client";

import ComponentCard from "@/components/common/ComponentCard";
import DemoNotice from "@/components/common/DemoNotice";
import { FormGrid, NumberField, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useOptions } from "@/hooks/useOptions";
import { PlusIcon, TrashBinIcon } from "@/icons";
import { clientName, patientName, userName } from "@/lib/calc";
import { formatDate, formatXOF, isoLocal, uid } from "@/lib/format";
import type { ConsultationInput } from "@/lib/services/consultationsService";
import { useState } from "react";

export const SNIPPETS: Record<string, string[]> = {
  anamnesis: ["Motif rapporté par le propriétaire : …", "Début des signes : …", "Alimentation / environnement : …", "Traitements en cours déclarés : …"],
  exam: ["État général : …", "Muqueuses : …", "Auscultation : …", "Palpation abdominale : …"],
  carePlan: ["Consignes au propriétaire : …", "Surveillance à domicile : …", "Contrôle prévu : …"],
};

export function emptyConsultation(clientId = "", patientId = "", vetId = ""): ConsultationInput {
  return {
    clientId,
    patientId,
    date: isoLocal(),
    reason: "",
    anamnesis: "",
    exam: "",
    hypotheses: "",
    diagnosis: "",
    complementaryExams: "",
    carePlan: "",
    observations: "",
    vetId,
    financialStatus: "non_regle",
    acts: [{ id: uid("act"), label: "Consultation", qty: 1, unitPrice: 15000 }],
  };
}

interface Props {
  value: ConsultationInput;
  onChange: (v: ConsultationInput) => void;
  lockParties?: boolean;
  actsLocked?: boolean;
}

/** Formulaire de consultation avec aide à la saisie (formules neutres) et prévisualisation du compte rendu. */
export default function ConsultationEditor({ value: v, onChange, lockParties, actsLocked }: Props) {
  const { db, user } = useDemo();
  const opts = useOptions();
  const [preview, setPreview] = useState(false);
  const set = <K extends keyof ConsultationInput>(k: K, x: ConsultationInput[K]) => onChange({ ...v, [k]: x });
  const snip = (k: "anamnesis" | "exam" | "carePlan") => (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {SNIPPETS[k].map((s) => (
        <button key={s} type="button" onClick={() => set(k, `${v[k] ? `${v[k]}\n` : ""}${s}`)} className="rounded-full border border-gray-200 px-2 py-0.5 text-[11px] text-gray-600 hover:border-brand-300 hover:text-brand-700 dark:border-gray-700 dark:text-gray-400">
          + {s.replace(" : …", "")}
        </button>
      ))}
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 xl:gap-6">
      <div className="space-y-4 xl:col-span-2 xl:space-y-6">
        <ComponentCard title="Patient et prise en charge">
          <FormGrid>
            <SelectField label="Client" required value={v.clientId} onChange={(x) => onChange({ ...v, clientId: x, patientId: "" })} options={opts.clients} disabled={lockParties} />
            <SelectField label="Patient" required value={v.patientId} onChange={(x) => set("patientId", x)} options={opts.patientsOf(v.clientId)} disabled={lockParties || !v.clientId} />
            <TextField label="Date et heure" type="datetime-local" value={v.date.slice(0, 16)} onChange={(x) => set("date", x)} />
            <TextField label="Motif" required value={v.reason} onChange={(x) => set("reason", x)} />
            <SelectField label="Vétérinaire responsable" required value={v.vetId} onChange={(x) => set("vetId", x)} options={opts.vets} hint="Un assistant ne peut pas être désigné responsable." />
            <TextField label="Auteur de la saisie" value={user?.name ?? ""} onChange={() => undefined} disabled />
          </FormGrid>
        </ComponentCard>
        <ComponentCard title="Anamnèse et examen clinique">
          <div>
            <TextAreaField label="Anamnèse" value={v.anamnesis} onChange={(x) => set("anamnesis", x)} rows={3} />
            {snip("anamnesis")}
          </div>
          <div>
            <TextAreaField label="Examen clinique" value={v.exam} onChange={(x) => set("exam", x)} rows={3} />
            {snip("exam")}
          </div>
          <FormGrid cols={3}>
            <NumberField label="Poids" suffix="kg" value={v.weightKg ?? NaN} onChange={(x) => set("weightKg", Number.isFinite(x) ? x : undefined)} step={0.1} />
            <NumberField label="Température" suffix="°C" value={v.temperature ?? NaN} onChange={(x) => set("temperature", Number.isFinite(x) ? x : undefined)} step={0.1} />
            <NumberField label="Fréq. cardiaque" suffix="bpm" value={v.heartRate ?? NaN} onChange={(x) => set("heartRate", Number.isFinite(x) ? x : undefined)} />
          </FormGrid>
        </ComponentCard>
        <ComponentCard title="Hypothèses, diagnostic et plan de soins" desc="Saisis par le professionnel — aucune suggestion clinique automatique">
          <TextAreaField label="Hypothèses" value={v.hypotheses} onChange={(x) => set("hypotheses", x)} rows={2} />
          <TextAreaField label="Diagnostic retenu" value={v.diagnosis} onChange={(x) => set("diagnosis", x)} rows={2} hint="Obligatoire pour soumettre à validation." />
          <TextAreaField label="Examens complémentaires" value={v.complementaryExams} onChange={(x) => set("complementaryExams", x)} rows={2} />
          <div>
            <TextAreaField label="Plan de soins / consignes" value={v.carePlan} onChange={(x) => set("carePlan", x)} rows={3} />
            {snip("carePlan")}
          </div>
          <TextAreaField label="Observations" value={v.observations} onChange={(x) => set("observations", x)} rows={2} />
          <TextField label="Contrôle recommandé le" type="date" value={v.followUpDate ?? ""} onChange={(x) => set("followUpDate", x || undefined)} />
        </ComponentCard>
      </div>
      <div className="space-y-4 xl:space-y-6">
        <ComponentCard
          title="Actes facturables"
          desc="Statut financier distinct du statut clinique"
          actions={
            !actsLocked && (
              <Button size="xs" variant="outline" startIcon={<PlusIcon />} onClick={() => set("acts", [...v.acts, { id: uid("act"), label: "", qty: 1, unitPrice: 0 }])}>
                Acte
              </Button>
            )
          }
        >
          {v.acts.map((a, i) => (
            <div key={a.id} className="grid grid-cols-[1fr_4rem_6rem_auto] items-end gap-2">
              <TextField label={i === 0 ? "Libellé" : ""} value={a.label} onChange={(x) => set("acts", v.acts.map((y, j) => (j === i ? { ...y, label: x } : y)))} disabled={actsLocked} />
              <NumberField label={i === 0 ? "Qté" : ""} value={a.qty} onChange={(x) => set("acts", v.acts.map((y, j) => (j === i ? { ...y, qty: x } : y)))} min={1} disabled={actsLocked} />
              <NumberField label={i === 0 ? "Prix" : ""} value={a.unitPrice} onChange={(x) => set("acts", v.acts.map((y, j) => (j === i ? { ...y, unitPrice: x } : y)))} min={0} step={500} disabled={actsLocked} />
              {!actsLocked && (
                <button type="button" onClick={() => set("acts", v.acts.filter((_, j) => j !== i))} className="mb-3 text-gray-400 hover:text-error-500" aria-label="Retirer">
                  <TrashBinIcon className="size-4" />
                </button>
              )}
            </div>
          ))}
          <p className="text-end text-sm font-semibold text-gray-800 dark:text-white/90">Total : {formatXOF(v.acts.reduce((s, a) => s + (a.qty || 0) * (a.unitPrice || 0), 0))}</p>
        </ComponentCard>
        <ComponentCard title="Aperçu du compte rendu" actions={<Button size="xs" variant="ghost" onClick={() => setPreview((p) => !p)}>{preview ? "Masquer" : "Afficher"}</Button>}>
          {preview ? (
            <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <p className="font-semibold text-gray-800 dark:text-white/90">Compte rendu de consultation — brouillon</p>
              <p>
                {patientName(db, v.patientId)} · {clientName(db, v.clientId)} · {formatDate(v.date)}
              </p>
              <p><strong>Motif :</strong> {v.reason || "—"}</p>
              <p><strong>Examen :</strong> {v.exam || "—"}</p>
              <p><strong>Diagnostic retenu :</strong> {v.diagnosis || "—"}</p>
              <p className="whitespace-pre-wrap"><strong>Consignes :</strong> {v.carePlan || "—"}</p>
              {v.followUpDate && <p><strong>Contrôle :</strong> {formatDate(v.followUpDate)}</p>}
              <p className="text-theme-xs text-gray-500">Responsable : {userName(db, v.vetId)} · Saisie : {user?.name}</p>
            </div>
          ) : (
            <DemoNotice>Prévisualisez le compte rendu avant soumission. Seule la validation par le vétérinaire responsable rend le dossier définitif.</DemoNotice>
          )}
        </ComponentCard>
      </div>
    </div>
  );
}
