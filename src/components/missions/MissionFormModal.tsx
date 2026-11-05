"use client";

import AppModal from "@/components/common/AppModal";
import { FormGrid, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useOptions } from "@/hooks/useOptions";
import { addDays } from "@/lib/format";
import { optionsOf } from "@/lib/labels";
import { createMission, updateMission, type MissionInput } from "@/lib/services/missionsService";
import type { EmergencyCall, Mission, MissionCategory, RuralType, ServiceType } from "@/lib/types";
import { cn } from "@/utils";
import { useEffect, useState } from "react";

const nowLocal = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const EMPTY_CALL: EmergencyCall = { calledAt: "", caller: "", callerPhone: "", reason: "", animals: "", severity: "grave" };
const DEFAULTS: Record<RuralType, Partial<MissionInput> & { interventions: string }> = {
  visite: { objective: "Visite sanitaire de l'élevage", category: "exploitation", serviceType: "consultance", interventions: "Inspection des bâtiments et de l'ambiance\nExamen clinique des animaux\nContrôle de la biosécurité\nPoint sur l'alimentation et l'abreuvement" },
  urgence: { objective: "", category: "urgence", serviceType: "intervention", interventions: "Examen clinique et autopsies\nTraitement de première intention" },
  mission: { objective: "", category: "exploitation", serviceType: "intervention", interventions: "" },
};
const TYPES: { key: RuralType; label: string; desc: string }[] = [
  { key: "visite", label: "Visite de ferme", desc: "Planifiée, avec rapport de visite" },
  { key: "urgence", label: "Urgence", desc: "Appel reçu, départ immédiat" },
  { key: "mission", label: "Mission", desc: "Campagne, formation, insémination…" },
];

export default function MissionFormModal({ isOpen, onClose, mission, onCreated, preset }: { isOpen: boolean; onClose: () => void; mission?: Mission; onCreated?: (id: string) => void; preset?: RuralType }) {
  const { db, run, today, user } = useDemo();
  const opts = useOptions();
  const [v, setV] = useState<MissionInput>({ objective: "", category: "exploitation", serviceType: "intervention", serviceLabel: "", date: "", endDate: "", location: "", leaderId: "", teamIds: [], farmIds: [], clientIds: [], plannedInterventions: [] });
  const [interventions, setInterventions] = useState("");
  const [type, setType] = useState<RuralType>("visite");
  const [call, setCall] = useState<EmergencyCall>(EMPTY_CALL);
  const applyType = (k: RuralType) => {
    const d = DEFAULTS[k];
    const day = k === "urgence" ? today : addDays(today, 3);
    setType(k);
    setV((s) => ({ ...s, objective: d.objective ?? "", category: d.category!, serviceType: d.serviceType!, date: day, endDate: day, ruralType: k }));
    setInterventions(d.interventions);
    if (k === "urgence") setCall({ ...EMPTY_CALL, calledAt: nowLocal() });
  };
  useEffect(() => {
    if (!isOpen) return;
    const m = mission;
    setV(m ? { objective: m.objective, category: m.category, serviceType: m.serviceType, serviceLabel: m.serviceLabel ?? "", date: m.date, endDate: m.endDate, location: m.location, leaderId: m.leaderId, teamIds: m.teamIds, farmIds: m.farmIds, clientIds: m.clientIds, plannedInterventions: m.plannedInterventions, ruralType: m.ruralType, emergency: m.emergency } : { objective: "", category: "exploitation", serviceType: "intervention", serviceLabel: "", date: addDays(today, 3), endDate: addDays(today, 3), location: "", leaderId: user?.roleId === "vet" || user?.roleId === "dg" ? user.id : "", teamIds: [], farmIds: [], clientIds: [], plannedInterventions: [] });
    setInterventions(m?.plannedInterventions.join("\n") ?? "");
    if (m) {
      setType(m.ruralType ?? "mission");
      setCall(m.emergency ?? EMPTY_CALL);
    } else applyType(preset ?? "visite");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mission, today]);
  const toggle = (k: "teamIds" | "farmIds", id: string) => setV((s) => ({ ...s, [k]: s[k].includes(id) ? s[k].filter((x) => x !== id) : [...s[k], id] }));
  const save = () => {
    const objective = type === "urgence" && !v.objective.trim() ? call.reason.split(/[,.;]/)[0].slice(0, 80) : v.objective;
    const input = { ...v, objective, ruralType: type, emergency: type === "urgence" ? call : undefined, plannedInterventions: interventions.split("\n").map((x) => x.trim()).filter(Boolean), clientIds: Array.from(new Set(v.farmIds.map((f) => db.farms.find((x) => x.id === f)?.clientId ?? ""))).filter(Boolean), location: v.location || v.farmIds.map((f) => db.farms.find((x) => x.id === f)?.location).join(", ") };
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
      title={mission ? `Modifier ${mission.code}` : type === "urgence" ? "Ouvrir une urgence rurale" : type === "visite" ? "Nouvelle visite de ferme" : "Nouvelle mission terrain"}
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={save} disabled={(type === "urgence" ? !call.reason.trim() : !v.objective.trim()) || !v.leaderId || !v.date}>{!mission && type === "urgence" ? "Ouvrir l'urgence" : "Enregistrer"}</Button>
        </>
      }
    >
      <div className="space-y-4">
        {!mission && (
          <div role="radiogroup" aria-label="Type d'intervention" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {TYPES.map((x) => (
              <button key={x.key} type="button" role="radio" aria-checked={type === x.key} onClick={() => applyType(x.key)} className={cn("rounded-xl border px-3 py-2 text-start transition", type === x.key ? (x.key === "urgence" ? "border-error-400 bg-error-50 dark:bg-error-500/10" : "border-brand-400 bg-brand-50 dark:bg-brand-500/10") : "border-gray-200 hover:border-gray-300 dark:border-gray-700")}>
                <span className={cn("block text-sm font-semibold", type === x.key && x.key === "urgence" ? "text-error-700 dark:text-error-300" : "text-gray-800 dark:text-white/90")}>{x.label}</span>
                <span className="block text-theme-xs text-gray-500 dark:text-gray-400">{x.desc}</span>
              </button>
            ))}
          </div>
        )}
        {type === "urgence" && (
          <fieldset className="space-y-3 rounded-xl border border-error-200 p-3 dark:border-error-800">
            <legend className="px-1 text-sm font-semibold text-error-700 dark:text-error-300">Appel d&apos;urgence</legend>
            <FormGrid>
              <TextField label="Appelant" value={call.caller} onChange={(caller) => setCall({ ...call, caller })} placeholder="Nom de l'éleveur ou du gérant" />
              <TextField label="Téléphone" value={call.callerPhone} onChange={(callerPhone) => setCall({ ...call, callerPhone })} />
              <TextField label="Heure de l'appel" type="datetime-local" value={call.calledAt.slice(0, 16)} onChange={(calledAt) => setCall({ ...call, calledAt })} />
              <SelectField label="Gravité" value={call.severity} onChange={(severity) => setCall({ ...call, severity: severity as EmergencyCall["severity"] })} options={[{ value: "vitale", label: "Pronostic vital engagé" }, { value: "grave", label: "Grave" }, { value: "moderee", label: "Modérée" }]} />
              <TextAreaField label="Motif de l'appel" required value={call.reason} onChange={(reason) => setCall({ ...call, reason })} rows={2} className="sm:col-span-2" placeholder="Ex. : vache couchée qui ne se relève pas depuis ce matin" />
              <TextField label="Animaux concernés" value={call.animals} onChange={(animals) => setCall({ ...call, animals })} placeholder="Ex. : 1 vache ; lot de 500 poulets de 21 jours" className="sm:col-span-2" />
            </FormGrid>
          </fieldset>
        )}
        <FormGrid>
          <TextField label={type === "urgence" ? "Intitulé (facultatif)" : "Objectif"} required={type !== "urgence"} value={v.objective} onChange={(objective) => setV({ ...v, objective })} className="sm:col-span-2" />
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
