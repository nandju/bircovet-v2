"use client";

import AppModal from "@/components/common/AppModal";
import { FormGrid, NumberField, SelectField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { phoneKey } from "@/lib/clientActivity";
import { optionsOf, SPECIES } from "@/lib/labels";
import { quickRegister, type QuickInput } from "@/lib/services/quickRegisterService";
import type { Patient } from "@/lib/types";
import { cn } from "@/utils";
import { useMemo, useState } from "react";

type Form = { mode: "nouveau" | "existant"; clientId: string; name: string; phone: string; city: string; pet: string; species: string; sex: Patient["sex"]; age: number; breed: string };
const EMPTY: Form = { mode: "nouveau", clientId: "", name: "", phone: "", city: "", pet: "", species: "Chien", sex: "inconnu", age: 0, breed: "" };

/**
 * Enregistrement rapide : propriétaire (nom + téléphone) et animal (nom, espèce),
 * pour consulter tout de suite. Le dossier est marqué « à compléter ».
 */
export default function QuickRegisterModal({ isOpen, onClose, onDone, submitLabel = "Enregistrer et ouvrir" }: { isOpen: boolean; onClose: () => void; onDone: (r: { clientId: string; patientId: string }) => void; submitLabel?: string }) {
  const { db, run } = useDemo();
  const [v, setV] = useState<Form>(EMPTY);
  const clients = useMemo(() => db.clients.filter((c) => !c.isWalkIn).sort((a, b) => a.name.localeCompare(b.name)), [db.clients]);
  const match = v.mode === "nouveau" && v.phone.replace(/\D/g, "").length >= 8 ? clients.find((c) => phoneKey(c.phone) === phoneKey(v.phone)) : undefined;
  const close = () => {
    setV(EMPTY);
    onClose();
  };
  const submit = () => {
    const input: QuickInput = {
      clientId: v.mode === "existant" ? v.clientId : undefined,
      client: v.mode === "nouveau" ? { name: v.name, phone: v.phone, city: v.city || undefined } : undefined,
      patient: { name: v.pet, species: v.species, sex: v.sex, ageYears: v.age || undefined, breed: v.breed || undefined },
    };
    const r = run(quickRegister, input);
    if (r.ok && r.data) {
      setV(EMPTY);
      onDone(r.data);
    }
  };
  return (
    <AppModal
      isOpen={isOpen}
      onClose={close}
      title="Enregistrement rapide"
      description="Le minimum pour prendre l'animal en charge tout de suite. Le dossier est marqué « à compléter » : vous ajouterez adresse, race, puce… ensuite."
      footer={
        <>
          <Button size="sm" variant="outline" onClick={close}>Annuler</Button>
          <Button size="sm" onClick={submit} disabled={!v.pet.trim() || (v.mode === "existant" ? !v.clientId : !v.name.trim() || !v.phone.trim())}>{submitLabel}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="inline-flex rounded-xl bg-gray-100 p-1 dark:bg-white/5" role="tablist">
          {(["nouveau", "existant"] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={v.mode === m} onClick={() => setV({ ...v, mode: m })} className={cn("rounded-lg px-3 py-1.5 text-sm font-medium", v.mode === m ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-800 dark:text-white" : "text-gray-500")}>
              {m === "nouveau" ? "Nouveau client" : "Client existant"}
            </button>
          ))}
        </div>
        <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">Propriétaire</p>
        {v.mode === "existant" ? (
          <SelectField label="Client" value={v.clientId} onChange={(x) => setV({ ...v, clientId: x })} options={clients.map((c) => ({ value: c.id, label: `${c.name} · ${c.phone}` }))} placeholder="Choisir un client" />
        ) : (
          <FormGrid cols={3}>
            <TextField label="Nom" value={v.name} onChange={(x) => setV({ ...v, name: x })} placeholder="Ex. : M. Kouassi" />
            <TextField label="Téléphone" type="tel" value={v.phone} onChange={(x) => setV({ ...v, phone: x })} placeholder="07 00 00 00 00" />
            <TextField label="Commune (facultatif)" value={v.city} onChange={(x) => setV({ ...v, city: x })} />
          </FormGrid>
        )}
        {match && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-warning-50 px-3 py-2 text-theme-sm text-warning-800 dark:bg-warning-500/10 dark:text-warning-300">
            <span>Ce numéro est déjà celui de <strong>{match.name}</strong>.</span>
            <Button size="xs" variant="soft" onClick={() => setV({ ...v, mode: "existant", clientId: match.id })}>Utiliser ce client</Button>
          </div>
        )}
        <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">Animal</p>
        <FormGrid cols={3}>
          <TextField label="Nom" value={v.pet} onChange={(x) => setV({ ...v, pet: x })} />
          <SelectField label="Espèce" value={v.species} onChange={(x) => setV({ ...v, species: x })} options={SPECIES.map((s) => ({ value: s, label: s }))} />
          <SelectField label="Sexe" value={v.sex} onChange={(x) => setV({ ...v, sex: x as Patient["sex"] })} options={optionsOf("sex")} />
          <NumberField label="Âge estimé" value={v.age} onChange={(x) => setV({ ...v, age: x })} min={0} max={40} step={0.5} suffix="an(s)" />
          <TextField label="Race (facultatif)" value={v.breed} onChange={(x) => setV({ ...v, breed: x })} className="sm:col-span-2" />
        </FormGrid>
      </div>
    </AppModal>
  );
}
