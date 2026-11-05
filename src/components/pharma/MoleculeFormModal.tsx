"use client";

import AppModal from "@/components/common/AppModal";
import { FormGrid, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useRouter } from "@/i18n/navigation";
import { FAMILIES, SPECIES } from "@/lib/pharma/model";
import { pharmaOf } from "@/lib/pharma/state";
import { saveDraftMolecule, type DraftInput } from "@/lib/services/pharmaService";
import { useEffect, useState } from "react";

const UNITS = ["mg/kg", "µg/kg", "g/kg", "UI/kg", "mL/kg", "mL/kg/h", "mg/animal", "µg/animal", "g/animal", "UI/animal", "mL/animal", "mg/L"];
const cell = "h-9 w-full rounded-md border border-gray-200 bg-transparent px-2 text-sm dark:border-gray-700 dark:text-white/90";
type Poso = DraftInput["posologies"][number];
const emptyPoso = (): Poso => ({ id: "", species: "ch", scheme: "", min: 0, max: 0, unit: "mg/kg", bound: "fourchette", route: "PO", frequency: "q24h", perDay: 1 });

/** Fiche molécule locale (absente de la base) : brouillon jusqu'à validation par un vétérinaire référent. */
export default function MoleculeFormModal({ isOpen, onClose, draftId }: { isOpen: boolean; onClose: () => void; draftId?: string }) {
  const { db, run } = useDemo();
  const router = useRouter();
  const [v, setV] = useState<DraftInput>({ name: "", synonyms: [], family: "atb", indications: "", contraindications: "", posologies: [emptyPoso()] });
  const [syn, setSyn] = useState("");
  useEffect(() => {
    if (!isOpen) return;
    const d = draftId ? pharmaOf(db).drafts.find((x) => x.id === draftId) : undefined;
    setV(d ? { name: d.name, synonyms: d.synonyms, family: d.family, indications: d.indications, contraindications: d.contraindications, posologies: d.posologies } : { name: "", synonyms: [], family: "atb", indications: "", contraindications: "", posologies: [emptyPoso()] });
    setSyn(d ? d.synonyms.join(", ") : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, draftId]);
  const setP = (i: number, patch: Partial<Poso>) => setV({ ...v, posologies: v.posologies.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const save = () => {
    const r = run(saveDraftMolecule, { ...v, id: draftId, synonyms: syn.split(",").map((s) => s.trim()).filter(Boolean) });
    if (r.ok) {
      onClose();
      if (!draftId && r.data) router.push(`/stock/molecules/${r.data}`);
    }
  };
  const n = (s: string) => Number(s.replace(",", "."));
  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={draftId ? "Modifier la fiche molécule" : "Nouvelle fiche molécule"}
      description="La fiche reste « non validée » tant qu'un vétérinaire référent ne l'a pas validée. Toute modification crée une nouvelle version."
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={save} disabled={!v.name.trim()}>Enregistrer</Button>
        </>
      }
    >
      <div className="space-y-5">
        <FormGrid>
          <TextField label="Molécule (DCI)" required value={v.name} onChange={(x) => setV({ ...v, name: x })} placeholder="Ex. : marbofloxacine" />
          <SelectField label="Famille" value={v.family} onChange={(x) => setV({ ...v, family: x })} options={FAMILIES.map((f) => ({ value: f.code, label: f.name }))} />
          <TextField label="Noms commerciaux / synonymes" value={syn} onChange={setSyn} placeholder="Séparés par des virgules : Marbocyl®, Forcyl®" className="sm:col-span-2" />
          <TextAreaField label="Indications" value={v.indications} onChange={(x) => setV({ ...v, indications: x })} rows={2} />
          <TextAreaField label="Contre-indications et effets" value={v.contraindications} onChange={(x) => setV({ ...v, contraindications: x })} rows={2} />
        </FormGrid>
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Posologies (une ligne par espèce et par schéma)</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="text-theme-xs text-gray-500">
                  {["Espèce", "Schéma", "Min", "Max", "Unité", "Borne", "Voie", "Rythme", "Prises/j", "Conc.", "Unité conc.", ""].map((h, i) => (
                    <th key={i} className="pb-1.5 text-start font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {v.posologies.map((p, i) => (
                  <tr key={i}>
                    <td className="pe-1 pb-1"><select aria-label="Espèce" value={p.species} onChange={(e) => setP(i, { species: e.target.value })} className={cell}>{SPECIES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}</select></td>
                    <td className="pe-1 pb-1"><input aria-label="Schéma" value={p.scheme} onChange={(e) => setP(i, { scheme: e.target.value })} placeholder="entretien" className={cell} /></td>
                    <td className="w-16 pe-1 pb-1"><input aria-label="Dose minimale" inputMode="decimal" value={p.min || ""} onChange={(e) => setP(i, { min: n(e.target.value) })} className={cell} /></td>
                    <td className="w-16 pe-1 pb-1"><input aria-label="Dose maximale" inputMode="decimal" value={p.max || ""} onChange={(e) => setP(i, { max: n(e.target.value) })} className={cell} /></td>
                    <td className="pe-1 pb-1"><select aria-label="Unité" value={p.unit} onChange={(e) => setP(i, { unit: e.target.value })} className={cell}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select></td>
                    <td className="pe-1 pb-1"><select aria-label="Type de borne" value={p.bound} onChange={(e) => setP(i, { bound: e.target.value as Poso["bound"] })} className={cell}><option value="fourchette">Fourchette</option><option value="plafond">Plafond</option><option value="minimum">Minimum</option></select></td>
                    <td className="w-16 pe-1 pb-1"><input aria-label="Voie" value={p.route} onChange={(e) => setP(i, { route: e.target.value })} className={cell} /></td>
                    <td className="w-20 pe-1 pb-1"><input aria-label="Rythme" value={p.frequency} onChange={(e) => setP(i, { frequency: e.target.value })} className={cell} /></td>
                    <td className="w-14 pe-1 pb-1"><input aria-label="Prises par jour" inputMode="numeric" value={p.perDay ?? ""} onChange={(e) => setP(i, { perDay: e.target.value ? n(e.target.value) : null })} className={cell} /></td>
                    <td className="w-16 pe-1 pb-1"><input aria-label="Concentration par défaut" inputMode="decimal" value={p.concValue ?? ""} onChange={(e) => setP(i, { concValue: e.target.value ? n(e.target.value) : undefined })} className={cell} /></td>
                    <td className="pe-1 pb-1"><select aria-label="Unité de concentration" value={p.concUnit ?? ""} onChange={(e) => setP(i, { concUnit: e.target.value || undefined })} className={cell}><option value="">—</option>{["mg/mL", "µg/mL", "%", "mg/comprimé", "UI/mL"].map((u) => <option key={u}>{u}</option>)}</select></td>
                    <td className="pb-1">{v.posologies.length > 1 && <button type="button" onClick={() => setV({ ...v, posologies: v.posologies.filter((_, j) => j !== i) })} className="text-theme-xs text-gray-400 hover:text-error-600">Retirer</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={() => setV({ ...v, posologies: [...v.posologies, emptyPoso()] })} className="mt-2 text-theme-xs font-medium text-brand-600 hover:underline dark:text-brand-400">+ Ajouter une posologie</button>
        </div>
      </div>
    </AppModal>
  );
}
