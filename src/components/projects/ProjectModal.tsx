"use client";

import AppModal from "@/components/common/AppModal";
import { FormGrid, NumberField, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useOptions } from "@/hooks/useOptions";
import { PROJECT_STATUS } from "@/lib/projects";
import { saveProject, type ProjectInput } from "@/lib/services/projectsService";
import type { ProjectStatus } from "@/lib/types";
import { useEffect, useState } from "react";

export const EMPTY_PROJECT: ProjectInput = { name: "", description: "", budget: undefined, startDate: "", endDate: "", status: "en_cours", ownerId: "", driveUrl: "" };

export default function ProjectModal({ value, onClose, onSaved }: { value: ProjectInput | null; onClose: () => void; onSaved?: (id: string) => void }) {
  const { run } = useDemo();
  const opts = useOptions();
  const [v, setV] = useState<ProjectInput>(EMPTY_PROJECT);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recharge le formulaire à l'ouverture
    if (value) setV(value);
  }, [value]);
  if (!value) return null;
  const save = () => {
    const r = run(saveProject, { ...v, startDate: v.startDate || undefined, endDate: v.endDate || undefined, ownerId: v.ownerId || undefined, driveUrl: v.driveUrl || undefined });
    if (r.ok && r.data) {
      onSaved?.(r.data);
      onClose();
    }
  };
  return (
    <AppModal
      isOpen
      onClose={onClose}
      title={v.id ? "Modifier le projet" : "Nouveau projet"}
      description="Travaux, campagne, achat d'équipement, ouverture d'un site… Les dépenses rattachées s'additionnent ici."
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={save} disabled={!v.name.trim()}>Enregistrer</Button>
        </>
      }
    >
      <FormGrid>
        <TextField label="Nom du projet" required value={v.name} onChange={(x) => setV({ ...v, name: x })} placeholder="Ex. : Rénovation du bloc opératoire" className="sm:col-span-2" />
        <NumberField label="Enveloppe prévue (facultatif)" suffix="FCFA" value={v.budget ?? NaN} onChange={(x) => setV({ ...v, budget: Number.isNaN(x) ? undefined : x })} min={0} step={10000} />
        <SelectField label="Statut" value={v.status} onChange={(x) => setV({ ...v, status: x as ProjectStatus })} options={Object.entries(PROJECT_STATUS).map(([k, m]) => ({ value: k, label: m.label }))} />
        <TextField label="Début" type="date" value={v.startDate ?? ""} onChange={(x) => setV({ ...v, startDate: x })} />
        <TextField label="Fin prévue" type="date" value={v.endDate ?? ""} onChange={(x) => setV({ ...v, endDate: x })} />
        <SelectField label="Responsable" value={v.ownerId ?? ""} onChange={(x) => setV({ ...v, ownerId: x })} options={opts.staff} allowEmpty placeholder="—" />
        <TextField label="Dossier Drive du projet" value={v.driveUrl ?? ""} onChange={(x) => setV({ ...v, driveUrl: x })} placeholder="https://drive.google.com/…" />
        <TextAreaField label="Description" value={v.description ?? ""} onChange={(x) => setV({ ...v, description: x })} rows={2} className="sm:col-span-2" />
      </FormGrid>
    </AppModal>
  );
}
