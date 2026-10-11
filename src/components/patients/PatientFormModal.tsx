"use client";

import AppModal from "@/components/common/AppModal";
import { CheckField, FormGrid, NumberField, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useOptions } from "@/hooks/useOptions";
import { optionsOf, SPECIES } from "@/lib/labels";
import { createPatient, updatePatient, type PatientInput } from "@/lib/services/patientsService";
import type { Patient } from "@/lib/types";
import { useEffect, useState } from "react";

const EMPTY: PatientInput = { name: "", species: "Chien", breed: "", sex: "inconnu", birthDate: "", birthDateEstimated: false, chip: "", passport: "", insurance: "", color: "", ownerId: "", allergies: [], alerts: [] };

export default function PatientFormModal({ isOpen, onClose, patient, defaultOwnerId, onCreated }: { isOpen: boolean; onClose: () => void; patient?: Patient; defaultOwnerId?: string; onCreated?: (id: string) => void }) {
  const { run } = useDemo();
  const opts = useOptions();
  const [v, setV] = useState<PatientInput>(EMPTY);
  const [weight, setWeight] = useState(NaN);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!isOpen) return;
    setErrors({});
    setWeight(NaN);
    setV(patient ? { ...EMPTY, ...patient } : { ...EMPTY, ownerId: defaultOwnerId ?? "" });
  }, [isOpen, patient, defaultOwnerId]);
  const set = <K extends keyof PatientInput>(k: K, val: PatientInput[K]) => setV((s) => ({ ...s, [k]: val }));

  const save = () => {
    const errs: Record<string, string> = {};
    if (!v.name.trim()) errs.name = "Obligatoire.";
    if (!v.ownerId) errs.ownerId = "Obligatoire.";
    if (!v.birthDate) errs.birthDate = "Date exacte ou estimée requise.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (patient) {
      const { ownerId: _o, ...patch } = v;
      void _o;
      if (run(updatePatient, { id: patient.id, patch }).ok) onClose();
    } else {
      const r = run(createPatient, { ...v, initialWeight: Number.isFinite(weight) ? weight : undefined });
      if (r.ok) {
        onClose();
        if (r.data) onCreated?.(r.data);
      }
    }
  };

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={patient ? `Modifier — ${patient.name}` : "Nouveau patient"}
      description="Données vétérinaires fictives destinées au test de l'interface."
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Annuler
          </Button>
          <Button size="sm" onClick={save}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormGrid cols={3}>
          <TextField label="Nom de l'animal" required value={v.name} onChange={(x) => set("name", x)} error={errors.name} />
          <SelectField label="Espèce" required value={v.species} onChange={(x) => set("species", x)} options={SPECIES.map((s) => ({ value: s, label: s }))} />
          <TextField label="Race" value={v.breed} onChange={(x) => set("breed", x)} />
          <SelectField label="Sexe" value={v.sex} onChange={(x) => set("sex", x as PatientInput["sex"])} options={optionsOf("sex")} />
          <TextField label="Date de naissance" required type="date" value={v.birthDate} onChange={(x) => set("birthDate", x)} error={errors.birthDate} />
          <div className="flex items-end pb-2">
            <CheckField label="Date estimée" checked={v.birthDateEstimated} onChange={(x) => set("birthDateEstimated", x)} />
          </div>
          <TextField label="Robe / couleur" value={v.color} onChange={(x) => set("color", x)} />
          <TextField label="Puce / identification" value={v.chip} onChange={(x) => set("chip", x)} />
          <TextField label="Passeport" value={v.passport} onChange={(x) => set("passport", x)} />
          <TextField label="Assurance" value={v.insurance} onChange={(x) => set("insurance", x)} />
          {!patient && <NumberField label="Poids initial" value={weight} onChange={setWeight} suffix="kg" min={0} step={0.1} />}
        </FormGrid>
        {!patient ? (
          <SelectField label="Propriétaire" required value={v.ownerId} onChange={(x) => set("ownerId", x)} options={opts.clients} error={errors.ownerId} />
        ) : (
          <p className="text-theme-xs text-gray-500">Le changement de propriétaire se fait via « Cession de propriété » afin de conserver l&apos;historique.</p>
        )}
        <FormGrid>
          <TextAreaField label="Allergies (une par ligne)" rows={2} value={v.allergies.join("\n")} onChange={(x) => set("allergies", x.split("\n"))} />
          <TextAreaField label="Alertes cliniques / comportement (une par ligne)" rows={2} value={v.alerts.join("\n")} onChange={(x) => set("alerts", x.split("\n"))} />
        </FormGrid>
      </div>
    </AppModal>
  );
}
