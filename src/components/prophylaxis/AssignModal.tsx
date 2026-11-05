"use client";

import AppModal from "@/components/common/AppModal";
import { FormGrid, NumberField, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { lotHeadcount } from "@/lib/care";
import { speciesOf } from "@/lib/farmProfile";
import { formatDate } from "@/lib/format";
import { COMPANION, PROPHY_KIND, scheduleSteps, startsAtOne } from "@/lib/prophylaxis";
import { assignProphylaxis } from "@/lib/services/prophylaxisService";
import type { ProphyTarget } from "@/lib/types";
import { cn } from "@/utils";
import { useEffect, useState } from "react";

export interface AssignPrefill {
  programId?: string;
  farmId?: string;
  lotId?: string;
  animalId?: string;
  patientId?: string;
}

const pill = (on: boolean) => cn("rounded-xl border px-3 py-2 text-sm font-medium", on ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300" : "border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300");

/** Appliquer un modèle à un cheptel, une bande, un animal identifié ou un animal de compagnie. */
export default function AssignModal({ prefill, onClose, onSaved }: { prefill: AssignPrefill | null; onClose: () => void; onSaved?: (planId: string) => void }) {
  const { db, run, today } = useDemo();
  const [kind, setKind] = useState<"farm" | "pet">("farm");
  const [target, setTarget] = useState<ProphyTarget>("lot");
  const [v, setV] = useState({ programId: "", farmId: "", lotId: "", animalId: "", patientId: "", startDate: today, count: NaN, note: "", pastDone: false });
  const [dates, setDates] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!prefill) return;
    const pet = !!prefill.patientId;
    setKind(pet ? "pet" : "farm");
    setTarget(pet ? "patient" : prefill.animalId ? "animal" : prefill.lotId ? "lot" : "lot");
    setV({ programId: prefill.programId ?? "", farmId: prefill.farmId ?? "", lotId: prefill.lotId ?? "", animalId: prefill.animalId ?? "", patientId: prefill.patientId ?? "", startDate: today, count: NaN, note: "", pastDone: false });
    setDates({});
  }, [prefill, today]);
  const programs = (db.prophylaxisPrograms ?? []).filter((p) => p.active);
  const pg = programs.find((p) => p.id === v.programId);
  const farm = db.farms.find((f) => f.id === v.farmId);
  const preview = pg && /^\d{4}-\d{2}-\d{2}$/.test(v.startDate) ? scheduleSteps(pg.steps, v.startDate, startsAtOne(pg.steps) ? 1 : 0) : [];
  if (!prefill) return null;
  const set = (patch: Partial<typeof v>) => setV((x) => ({ ...x, ...patch }));
  const petPatients = db.patients.filter((p) => !p.archived && p.vitalStatus === "vivant" && (!pg || pg.species === "Autre" || pg.species === p.species || !COMPANION.includes(pg.species)));
  const species = (sp: string) => !pg || pg.species === "Autre" || speciesOf(sp) === pg.species || (pg.species === "Caprin" && speciesOf(sp) === "Ovin");
  const lots = farm?.lots.filter((l) => l.status === "actif" && species(l.species)) ?? [];
  const animals = (farm?.animals ?? []).filter((a) => a.status === "present" && species(a.species));
  const defaultCount = farm ? (target === "lot" && v.lotId ? lotHeadcount(farm, v.lotId) : target === "cheptel" ? farm.lots.filter((l) => l.status === "actif" && species(l.species)).reduce((s, l) => s + lotHeadcount(farm, l.id), 0) : 0) : 0;
  const save = () => {
    const r = run(assignProphylaxis, { programId: v.programId, target: kind === "pet" ? "patient" : target, farmId: v.farmId || undefined, lotId: v.lotId || undefined, animalId: v.animalId || undefined, patientId: v.patientId || undefined, count: Number.isFinite(v.count) ? v.count : defaultCount || undefined, startDate: v.startDate, dates, note: v.note, pastDone: v.pastDone });
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
      title="Appliquer un programme de prophylaxie"
      description="Les dates sont calculées depuis la date de début. Vous pouvez en changer avant de valider, puis à tout moment."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={!pg}>Appliquer le programme</Button>
        </>
      }
    >
      <div className="space-y-5">
        <SelectField label="Programme" required value={v.programId} onChange={(x) => { set({ programId: x }); setDates({}); const p = programs.find((y) => y.id === x); if (p && COMPANION.includes(p.species)) { setKind("pet"); setTarget("patient"); } else if (p && kind === "pet" && !prefill.patientId) { setKind("farm"); setTarget("lot"); } }} options={programs.map((p) => ({ value: p.id, label: `${p.name} · ${p.species}` }))} />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Pour qui">
          <button type="button" className={pill(kind === "farm")} onClick={() => { setKind("farm"); setTarget("lot"); }}>Un élevage</button>
          <button type="button" className={pill(kind === "pet")} onClick={() => { setKind("pet"); setTarget("patient"); }}>Un animal de compagnie</button>
        </div>
        {kind === "farm" ? (
          <>
            <SelectField label="Exploitation" required value={v.farmId} onChange={(x) => set({ farmId: x, lotId: "", animalId: "" })} options={db.farms.filter((f) => f.status === "actif").map((f) => ({ value: f.id, label: `${f.name} · ${f.location}` }))} />
            {farm && (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Animaux concernés">
                <button type="button" className={pill(target === "lot")} onClick={() => setTarget("lot")}>Une bande / un lot</button>
                <button type="button" className={pill(target === "cheptel")} onClick={() => setTarget("cheptel")}>Tout le cheptel</button>
                <button type="button" className={pill(target === "animal")} onClick={() => setTarget("animal")}>Un animal identifié</button>
              </div>
            )}
            {farm && target === "lot" && <SelectField label="Bande ou lot" required value={v.lotId} onChange={(x) => set({ lotId: x })} options={lots.map((l) => ({ value: l.id, label: `${l.name} · ${speciesOf(l.species)}${l.category ? ` · ${l.category}` : ""} (${lotHeadcount(farm, l.id)} sujets, depuis le ${formatDate(l.startDate)})` }))} placeholder={lots.length ? "Choisir" : "Aucune bande de cette espèce"} />}
            {farm && target === "animal" && <SelectField label="Animal" required value={v.animalId} onChange={(x) => set({ animalId: x })} options={animals.map((a) => ({ value: a.id, label: `n° ${a.tag}${a.name ? ` · ${a.name}` : ""} · ${a.species}` }))} placeholder={animals.length ? "Choisir" : "Aucun animal identifié de cette espèce"} />}
          </>
        ) : (
          <SelectField label="Animal" required value={v.patientId} onChange={(x) => set({ patientId: x })} options={petPatients.map((p) => ({ value: p.id, label: `${p.name} · ${p.species} · ${db.clients.find((c) => c.id === p.ownerId)?.name ?? ""}` }))} />
        )}
        <FormGrid cols={2}>
          <TextField label={pg ? `Date de début : ${pg.startLabel}` : "Date de début"} type="date" required value={v.startDate} onChange={(x) => { set({ startDate: x }); setDates({}); }} hint={kind === "farm" && target === "lot" && v.lotId && farm ? `Bande démarrée le ${formatDate(farm.lots.find((l) => l.id === v.lotId)!.startDate)}` : undefined} />
          {kind === "farm" && target !== "animal" && <NumberField label="Nombre d'animaux" value={Number.isFinite(v.count) ? v.count : defaultCount} onChange={(x) => set({ count: x })} min={1} />}
        </FormGrid>
        {kind === "farm" && target === "lot" && v.lotId && farm && (
          <button type="button" className="text-theme-sm font-medium text-brand-600 hover:underline dark:text-brand-400" onClick={() => { set({ startDate: farm.lots.find((l) => l.id === v.lotId)!.startDate }); setDates({}); }}>Démarrer à la date d&apos;arrivée de la bande</button>
        )}
        {preview.length > 0 && (
          <section>
            <h4 className="mb-2 text-sm font-semibold text-gray-800 dark:text-white/90">Calendrier prévu ({preview.length} actions)</h4>
            <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
              {preview.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                  <input aria-label={`Date prévue : ${s.label}`} type="date" className={cn("h-9 rounded-lg border bg-transparent px-2 text-sm tabular-nums dark:bg-gray-900", dates[s.id] ? "border-brand-500" : "border-gray-300 dark:border-gray-700", (dates[s.id] ?? s.dueDate) < today && "text-gray-400")} value={dates[s.id] ?? s.dueDate} onChange={(e) => setDates((d) => ({ ...d, [s.id]: e.target.value }))} />
                  <span className="w-10 text-theme-xs tabular-nums text-gray-500">J{s.day}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", PROPHY_KIND[s.kind].tone)}>{PROPHY_KIND[s.kind].label}</span>
                  <span className="min-w-0 flex-1 text-sm text-gray-800 dark:text-white/90">{s.label}{s.product && <span className="text-gray-500"> · {s.product}</span>}</span>
                </li>
              ))}
            </ul>
            {preview.some((s) => (dates[s.id] ?? s.dueDate) < today) && (
              <label className="mt-3 flex items-start gap-2 rounded-xl bg-gray-50 px-3 py-2 text-theme-sm text-gray-700 dark:bg-white/5 dark:text-gray-300">
                <input type="checkbox" className="mt-0.5" checked={v.pastDone} onChange={(e) => set({ pastDone: e.target.checked })} />
                <span>Les actions dont la date est passée ont déjà été faites. <span className="text-gray-500">Sinon, elles apparaîtront « en retard ».</span></span>
              </label>
            )}
          </section>
        )}
        <TextAreaField label="Remarque (facultatif)" rows={2} value={v.note} onChange={(x) => set({ note: x })} />
      </div>
    </AppModal>
  );
}
