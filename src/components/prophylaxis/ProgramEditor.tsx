"use client";

import AppModal from "@/components/common/AppModal";
import { FormGrid, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { PlusIcon } from "@/icons";
import { PROPHY_KINDS, PROPHY_SPECIES } from "@/lib/prophylaxis";
import { saveProphylaxisProgram, type ProgramInput } from "@/lib/services/prophylaxisService";
import type { ProphyKind, ProphyStepTemplate } from "@/lib/types";
import { uid } from "@/lib/format";
import { useEffect, useState } from "react";

const cell = "h-9 w-full rounded-lg border border-gray-300 bg-transparent px-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";

export const EMPTY_PROGRAM: ProgramInput = { name: "", species: "Volaille", category: "", startLabel: "Arrivée des animaux (J1)", description: "", steps: [] };

/** Création ou modification d'un modèle de programme : une ligne par action, placée en jours. */
export default function ProgramEditor({ value, onClose, onSaved }: { value: ProgramInput | null; onClose: () => void; onSaved?: (id: string) => void }) {
  const { run } = useDemo();
  const [f, setF] = useState<ProgramInput>(EMPTY_PROGRAM);
  useEffect(() => {
    if (value) setF({ ...value, steps: value.steps.length ? value.steps.map((s) => ({ ...s, id: s.id || uid("pst") })) : [{ id: uid("pst"), day: 1, kind: "vaccination", label: "" }] });
  }, [value]);
  if (!value) return null;
  const set = (patch: Partial<ProgramInput>) => setF((x) => ({ ...x, ...patch }));
  const setStep = (i: number, patch: Partial<ProphyStepTemplate>) => setF((x) => ({ ...x, steps: x.steps.map((s, k) => (k === i ? { ...s, ...patch } : s)) }));
  const addStep = () => setF((x) => ({ ...x, steps: [...x.steps, { id: uid("pst"), day: (x.steps.at(-1)?.day ?? 0) + 7, kind: "vaccination", label: "" }] }));
  const save = () => {
    const r = run(saveProphylaxisProgram, f);
    if (r.ok) {
      onClose();
      if (r.data) onSaved?.(r.data);
    }
  };
  return (
    <AppModal
      isOpen
      onClose={onClose}
      size="xl"
      title={value.id ? `Modifier « ${value.name} »` : "Nouveau modèle de prophylaxie"}
      description="Chaque action est placée en jours depuis le début : J1 = arrivée des poussins, J0 = naissance ou début du programme."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={save}>Enregistrer le modèle</Button>
        </>
      }
    >
      <div className="space-y-5">
        <FormGrid cols={2}>
          <TextField label="Nom du programme" required value={f.name} onChange={(v) => set({ name: v })} placeholder="Poulets de chair (45 jours)" />
          <SelectField label="Espèce" required value={f.species} onChange={(v) => set({ species: v })} options={PROPHY_SPECIES.map((s) => ({ value: s, label: s }))} />
          <TextField label="Catégorie (facultatif)" value={f.category ?? ""} onChange={(v) => set({ category: v })} placeholder="Pondeuses, chiot, troupeau…" />
          <TextField label="Point de départ" value={f.startLabel} onChange={(v) => set({ startLabel: v })} placeholder="Arrivée des poussins (J1)" hint="Indiquez J1 si le premier jour compte comme jour 1." />
        </FormGrid>
        <TextAreaField label="Remarques (facultatif)" rows={2} value={f.description ?? ""} onChange={(v) => set({ description: v })} placeholder="Conditions d'utilisation, réglementation, conseils à l'éleveur…" />
        <section>
          <h4 className="mb-2 text-sm font-semibold text-gray-800 dark:text-white/90">Actions ({f.steps.filter((s) => s.label.trim()).length})</h4>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="text-start text-theme-xs text-gray-500">
                  {["Jour", "Type", "Action", "Produit", "Dose", "Voie", "Remarque", ""].map((h) => <th key={h} className="pb-1.5 pe-2 text-start font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {f.steps.map((s, i) => (
                  <tr key={s.id} className="align-top">
                    <td className="w-20 py-1 pe-2"><input aria-label="Jour" type="number" min={0} className={cell} value={Number.isFinite(s.day) ? s.day : ""} onChange={(e) => setStep(i, { day: e.target.value === "" ? NaN : Number(e.target.value) })} /></td>
                    <td className="w-40 py-1 pe-2">
                      <select aria-label="Type" className={cell} value={s.kind} onChange={(e) => setStep(i, { kind: e.target.value as ProphyKind })}>
                        {PROPHY_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                      </select>
                    </td>
                    <td className="py-1 pe-2"><input aria-label="Action" className={cell} value={s.label} onChange={(e) => setStep(i, { label: e.target.value })} placeholder="Newcastle (rappel)" /></td>
                    <td className="w-36 py-1 pe-2"><input aria-label="Produit" className={cell} value={s.product ?? ""} onChange={(e) => setStep(i, { product: e.target.value })} /></td>
                    <td className="w-24 py-1 pe-2"><input aria-label="Dose" className={cell} value={s.dose ?? ""} onChange={(e) => setStep(i, { dose: e.target.value })} /></td>
                    <td className="w-32 py-1 pe-2"><input aria-label="Voie" className={cell} value={s.route ?? ""} onChange={(e) => setStep(i, { route: e.target.value })} placeholder="Eau, SC, IM…" /></td>
                    <td className="w-40 py-1 pe-2"><input aria-label="Remarque" className={cell} value={s.note ?? ""} onChange={(e) => setStep(i, { note: e.target.value })} /></td>
                    <td className="py-1"><button type="button" aria-label="Retirer l'action" className="h-9 rounded-lg px-2 text-gray-400 hover:bg-error-50 hover:text-error-600" onClick={() => setF((x) => ({ ...x, steps: x.steps.filter((_, k) => k !== i) }))}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button size="sm" variant="soft" className="mt-2" startIcon={<PlusIcon />} onClick={addStep}>Ajouter une action</Button>
          <p className="mt-2 text-theme-xs text-gray-500">Les actions sont triées par jour à l&apos;enregistrement. Modifier un modèle ne change pas les programmes déjà appliqués.</p>
        </section>
      </div>
    </AppModal>
  );
}
