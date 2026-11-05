"use client";

import AppModal from "@/components/common/AppModal";
import { FormGrid, NumberField, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { CLIENTELE_LABEL, COUNTRIES, LANG_LABEL } from "@/lib/platform";
import { saveClinic, type ClinicInput } from "@/lib/services/platformService";
import type { Clientele3, ClinicLanguage, PlatformClinic } from "@/lib/types";
import { useEffect, useState } from "react";

export default function ClinicModal({ value, onClose }: { value: ClinicInput | null; onClose: () => void }) {
  const { run } = useDemo();
  const [v, setV] = useState<ClinicInput | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recharge le formulaire à l'ouverture
    setV(value);
  }, [value]);
  if (!value || !v) return null;
  const set = <K extends keyof ClinicInput>(k: K, x: ClinicInput[K]) => setV({ ...v, [k]: x });
  return (
    <AppModal
      isOpen
      onClose={onClose}
      size="lg"
      title={v.id ? "Modifier la clinique" : "Nouvelle clinique cliente"}
      footer={<><Button size="sm" variant="outline" onClick={onClose}>Annuler</Button><Button size="sm" onClick={() => run(saveClinic, v).ok && onClose()} disabled={!v.name.trim()}>Enregistrer</Button></>}
    >
      <FormGrid>
        <TextField label="Nom de la clinique" required value={v.name} onChange={(x) => set("name", x)} className="sm:col-span-2" />
        <SelectField label="Pays" value={v.country} onChange={(x) => set("country", x)} options={COUNTRIES.map((c) => ({ value: c, label: c }))} />
        <TextField label="Ville" value={v.city} onChange={(x) => set("city", x)} />
        <SelectField label="Langue de l'interface" value={v.language} onChange={(x) => set("language", x as ClinicLanguage)} options={Object.entries(LANG_LABEL).map(([value, label]) => ({ value, label }))} />
        <SelectField label="Clientèle" value={v.clientele} onChange={(x) => set("clientele", x as Clientele3)} options={Object.entries(CLIENTELE_LABEL).map(([value, label]) => ({ value, label }))} />
        <TextField label="Contact (DG)" value={v.contactName} onChange={(x) => set("contactName", x)} />
        <TextField label="Téléphone" type="tel" value={v.phone} onChange={(x) => set("phone", x)} />
        <TextField label="E-mail" type="email" value={v.email} onChange={(x) => set("email", x)} className="sm:col-span-2" />
        <NumberField label="Prix de la licence (vente directe)" suffix="FCFA" value={v.licencePrice} onChange={(x) => set("licencePrice", x)} min={0} step={100000} />
        <SelectField label="Statut" value={v.status} onChange={(x) => set("status", x as PlatformClinic["status"])} options={[{ value: "prospect", label: "Prospect" }, { value: "actif", label: "Active" }, { value: "suspendu", label: "Suspendue" }]} />
        <NumberField label="Maintenance" suffix="FCFA" value={v.maintenanceAmount} onChange={(x) => set("maintenanceAmount", x)} min={0} step={5000} />
        <SelectField label="Rythme de la maintenance" value={v.maintenancePeriod} onChange={(x) => set("maintenancePeriod", x as "mensuel" | "annuel")} options={[{ value: "mensuel", label: "Mensuelle" }, { value: "annuel", label: "Annuelle" }]} />
        <NumberField label="Utilisateurs" value={v.users} onChange={(x) => set("users", x)} min={1} />
        <NumberField label="Sites" value={v.sites} onChange={(x) => set("sites", x)} min={1} />
        <TextAreaField label="Notes internes" value={v.notes ?? ""} onChange={(x) => set("notes", x)} rows={2} className="sm:col-span-2" />
      </FormGrid>
    </AppModal>
  );
}
