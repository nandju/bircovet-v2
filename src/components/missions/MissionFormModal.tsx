"use client";

import AppModal from "@/components/common/AppModal";
import { FormGrid, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useOptions } from "@/hooks/useOptions";
import { addDays } from "@/lib/format";
import { optionsOf } from "@/lib/labels";
import { createMission, updateMission, type MissionInput } from "@/lib/services/missionsService";
import type { Mission, MissionCategory, ServiceType } from "@/lib/types";
import { cn } from "@/utils";
import { useEffect, useState } from "react";

export default function MissionFormModal({ isOpen, onClose, mission, onCreated }: { isOpen: boolean; onClose: () => void; mission?: Mission; onCreated?: (id: string) => void }) {
  const { db, run, today } = useDemo();
  const opts = useOptions();
  const [v, setV] = useState<MissionInput>({ objective: "", category: "exploitation", serviceType: "intervention", serviceLabel: "", date: "", endDate: "", location: "", leaderId: "", teamIds: [], farmIds: [], clientIds: [], plannedInterventions: [] });
  const [interventions, setInterventions] = useState("");
  useEffect(() => {
    if (!isOpen) return;
    const m = mission;
    setV(m ? { objective: m.objective, category: m.category, serviceType: m.serviceType, serviceLabel: m.serviceLabel ?? "", date: m.date, endDate: m.endDate, location: m.location, leaderId: m.leaderId, teamIds: m.teamIds, farmIds: m.farmIds, clientIds: m.clientIds, plannedInterventions: m.plannedInterventions } : { objective: "", category: "exploitation", serviceType: "intervention", serviceLabel: "", date: addDays(today, 3), endDate: addDays(today, 3), location: "", leaderId: "", teamIds: [], farmIds: [], clientIds: [], plannedInterventions: [] });
    setInterventions(m?.plannedInterventions.join("\n") ?? "");
  }, [isOpen, mission, today]);
  const toggle = (k: "teamIds" | "farmIds", id: string) => setV((s) => ({ ...s, [k]: s[k].includes(id) ? s[k].filter((x) => x !== id) : [...s[k], id] }));
  const save = () => {
    const input = { ...v, plannedInterventions: interventions.split("\n").map((x) => x.trim()).filter(Boolean), clientIds: Array.from(new Set(v.farmIds.map((f) => db.farms.find((x) => x.id === f)?.clientId ?? ""))).filter(Boolean), location: v.location || v.farmIds.map((f) => db.farms.find((x) => x.id === f)?.location).join(", ") };
    if (mission) return run(updateMission, { id: mission.id, patch: input }).ok && onClose();
    const r = run(createMission, input);
    if (r.ok) {
      onClose();
      if (r.data) onCreated?.(r.data);
    }
  };
  const chip = (active: boolean) => cn("rounded-full border px-3 py-1.5 text-sm", active ? "border-brand-400 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300" : "border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400");
  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={mission ? `Modifier ${mission.code}` : "Nouvelle mission terrain"}
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={save} disabled={!v.objective.trim() || !v.leaderId || !v.date}>Enregistrer</Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormGrid>
          <TextField label="Objectif" required value={v.objective} onChange={(objective) => setV({ ...v, objective })} className="sm:col-span-2" />
          <SelectField label="Catégorie de mission" required value={v.category} onChange={(category) => setV({ ...v, category: category as MissionCategory })} options={optionsOf("missionCategory")} />
          <SelectField label="Type de prestation" required value={v.serviceType} onChange={(serviceType) => setV({ ...v, serviceType: serviceType as ServiceType })} options={optionsOf("serviceType")} />
          {v.serviceType === "autre" && <TextField label="Prestation personnalisée" value={v.serviceLabel ?? ""} onChange={(serviceLabel) => setV({ ...v, serviceLabel })} />}
          <TextField label="Début" type="date" value={v.date} onChange={(date) => setV({ ...v, date, endDate: v.endDate < date ? date : v.endDate })} />
          <TextField label="Fin" type="date" value={v.endDate} onChange={(endDate) => setV({ ...v, endDate })} />
          <SelectField label="Responsable" required value={v.leaderId} onChange={(leaderId) => setV({ ...v, leaderId })} options={opts.vets} />
          <TextField label="Lieu (si différent des exploitations)" value={v.location} onChange={(location) => setV({ ...v, location })} />
        </FormGrid>
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-400">Membres de l&apos;équipe</p>
          <div className="flex flex-wrap gap-2">
            {opts.staff.filter((s) => s.value !== v.leaderId).map((s) => (
              <button key={s.value} type="button" className={chip(v.teamIds.includes(s.value))} onClick={() => toggle("teamIds", s.value)}>{s.label}</button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-400">Exploitations concernées</p>
          <div className="flex flex-wrap gap-2">
            {opts.farms.map((f) => (
              <button key={f.value} type="button" className={chip(v.farmIds.includes(f.value))} onClick={() => toggle("farmIds", f.value)}>{f.label}</button>
            ))}
          </div>
        </div>
        <TextAreaField label="Interventions prévues (une par ligne)" value={interventions} onChange={setInterventions} rows={3} />
      </div>
    </AppModal>
  );
}
