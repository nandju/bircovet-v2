"use client";

import AppModal from "@/components/common/AppModal";
import { FormGrid, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { INDEX_SPECIES } from "@/lib/drugIndex";
import { deleteDrugIndexEntry, saveDrugIndexEntry } from "@/lib/services/drugIndexService";
import type { DrugIndexEntry } from "@/lib/types";
import { useEffect, useState } from "react";

export type EntryDraft = Partial<DrugIndexEntry> & { species: string; molecule: string };

export default function DrugIndexEntryModal({ value, onClose }: { value: EntryDraft | null; onClose: () => void }) {
  const { run } = useDemo();
  const [v, setV] = useState<EntryDraft>({ species: "Cheval", molecule: "" });
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (value) {
      setV(value);
      setConfirm(false);
    }
  }, [value]);
  if (!value) return null;
  const set = (k: keyof EntryDraft) => (x: string) => setV((p) => ({ ...p, [k]: x }));
  const save = () => {
    const r = run(saveDrugIndexEntry, { id: v.id, species: v.species, molecule: v.molecule, indication: v.indication, dosage: v.dosage, route: v.route, amm: v.amm, note: v.note });
    if (r.ok) onClose();
  };
  const remove = () => {
    if (!v.id) return;
    if (!confirm) return setConfirm(true);
    if (run(deleteDrugIndexEntry, { id: v.id }).ok) onClose();
  };
  return (
    <AppModal
      isOpen
      onClose={onClose}
      size="lg"
      title={v.id ? `Modifier · ${value.molecule}` : "Ajouter une ligne à l'index"}
      footer={
        <>
          {v.id && <Button variant="ghost" onClick={remove}>{confirm ? "Confirmer la suppression" : "Supprimer"}</Button>}
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={save}>Enregistrer</Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormGrid cols={2}>
          <TextField label="Molécule" required value={v.molecule} onChange={set("molecule")} />
          <SelectField label="Espèce" value={v.species} onChange={set("species")} options={INDEX_SPECIES.map((s) => ({ value: s, label: s }))} />
          <TextField label="Indication" value={v.indication ?? ""} onChange={set("indication")} />
          <TextField label="Posologie" value={v.dosage ?? ""} onChange={set("dosage")} placeholder="Ex. 1,1 mg/kg SID" />
          <TextField label="Voie" value={v.route ?? ""} onChange={set("route")} placeholder="IV, IM, PO…" />
          <TextField label="AMM" value={v.amm ?? ""} onChange={set("amm")} placeholder="Vétérinaire, humaine…" />
        </FormGrid>
        <TextAreaField label="Note (facultatif)" rows={2} value={v.note ?? ""} onChange={set("note")} />
      </div>
    </AppModal>
  );
}
