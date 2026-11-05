"use client";

import AppModal from "@/components/common/AppModal";
import SpeciesIcon from "@/components/common/SpeciesIcon";
import { FormGrid, NumberField, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useOptions } from "@/hooks/useOptions";
import { ADVICE_CHIPS, CARE_REASON, CARE_SCOPE, lotHeadcount, speciesHeadcount } from "@/lib/care";
import { HERD, speciesOf } from "@/lib/farmProfile";
import { openCareCase, type CareInput } from "@/lib/services/careService";
import type { CareCase, CareReason, CareScope } from "@/lib/types";
import { cn } from "@/utils";
import { useEffect, useState } from "react";

type Line = { product: string; dose: string; route: string; duration: string; count: number };
const LINE: Line = { product: "", dose: "", route: "", duration: "", count: 1 };
const ROUTES = ["IM", "SC", "IV", "Orale", "Eau de boisson", "Aliment", "Cutanée (pour-on)", "Intramammaire", "Locale"];

function Seg<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: string; hint?: string; emoji?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className={cn("grid gap-2", options.length > 3 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-3")} role="radiogroup">
      {options.map((o) => (
        <button key={o.v} type="button" role="radio" aria-checked={value === o.v} onClick={() => onChange(o.v)} className={cn("flex items-start gap-2 rounded-2xl border px-3 py-2.5 text-start", value === o.v ? "border-orange-500 bg-orange-50 dark:bg-orange-500/10" : "border-gray-200 hover:border-orange-300 dark:border-gray-700")}>
          {o.emoji && <span aria-hidden className="text-xl leading-none">{o.emoji}</span>}
          <span>
            <span className="block text-sm font-semibold text-gray-800 dark:text-white/90">{o.label}</span>
            {o.hint && <span className="block text-theme-xs text-gray-500">{o.hint}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

export interface CarePrefill {
  farmId: string;
  scope?: CareScope;
  reason?: CareReason;
  species?: string;
  animalId?: string;
  lotId?: string;
  parent?: CareCase;
  missionId?: string;
}

/** Consultation et prise en charge en élevage, en un seul formulaire guidé. */
export default function CareCaseModal({ prefill, onClose, onSaved }: { prefill: CarePrefill | null; onClose: () => void; onSaved?: (id: string) => void }) {
  const { db, run, today, user } = useDemo();
  const opts = useOptions();
  const f = prefill ? db.farms.find((x) => x.id === prefill.farmId) : undefined;
  const species = f ? [...new Set([...f.lots.filter((l) => l.status === "actif").map((l) => speciesOf(l.species)), ...(f.animals ?? []).map((a) => a.species)])] : [];
  const [scope, setScope] = useState<CareScope>("animal");
  const [reason, setReason] = useState<CareReason>("appel");
  const [sp, setSp] = useState("");
  const [animalId, setAnimalId] = useState("");
  const [newA, setNewA] = useState({ tag: "", name: "", sex: "" as "" | "male" | "femelle", ageText: "", lotId: "" });
  const [lotId, setLotId] = useState("");
  const [count, setCount] = useState(1);
  const [v, setV] = useState({ date: today, vetId: "", missionId: "", complaint: "", temperature: NaN, heartRate: NaN, respRate: NaN, findings: "", diagnosis: "", advice: "", nextDays: 2, addToVisit: true });
  const [lines, setLines] = useState<Line[]>([{ ...LINE }]);
  useEffect(() => {
    if (!prefill || !f) return;
    const p = prefill.parent;
    const s0 = prefill.species ?? p?.species ?? species[0] ?? "Bovin";
    const sc = prefill.scope ?? "animal";
    const rs = prefill.reason ?? (p ? "pathologie" : "appel");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- formulaire réinitialisé à l'ouverture
    setScope(sc);
    setReason(rs);
    setSp(s0);
    setAnimalId(prefill.animalId ?? "");
    setNewA({ tag: "", name: "", sex: "", ageText: "", lotId: "" });
    setLotId(prefill.lotId ?? "");
    setCount(sc === "cheptel" ? speciesHeadcount(f, s0, speciesOf) || 1 : 1);
    setV({ date: today, vetId: user?.roleId === "vet" || user?.roleId === "dg" ? user.id : "", missionId: prefill.missionId ?? "", complaint: p ? `Suite au diagnostic sur ${p.code}` : "", temperature: NaN, heartRate: NaN, respRate: NaN, findings: "", diagnosis: p?.diagnosis ?? "", advice: p?.advice ?? "", nextDays: CARE_REASON[rs].days, addToVisit: true });
    setLines(p?.treatments.length ? p.treatments.map((t) => ({ product: t.product, dose: t.dose ?? "", route: t.route ?? "", duration: t.duration ?? "", count: 1 })) : [{ ...LINE }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);
  if (!prefill || !f) return null;
  const animals = (f.animals ?? []).filter((a) => a.status === "present" && a.species === sp);
  const lots = f.lots.filter((l) => l.status === "actif" && speciesOf(l.species) === sp);
  const missions = db.missions.filter((m) => m.farmIds.includes(f.id) && m.date.slice(0, 10) <= v.date && m.endDate.slice(0, 10) >= v.date.slice(0, 10));
  const total = scope === "animal" ? 1 : count;
  const setScopeX = (s: CareScope) => {
    setScope(s);
    if (s === "cheptel") setCount(speciesHeadcount(f, sp, speciesOf) || 1);
    if (s === "lot" && lotId) setCount(lotHeadcount(f, lotId) || 1);
    setLines((ls) => ls.map((l) => ({ ...l, count: s === "animal" ? 1 : l.count === 1 ? count : l.count })));
  };
  const addAdvice = (a: string) => setV((x) => ({ ...x, advice: x.advice.includes(a) ? x.advice : `${x.advice ? `${x.advice.replace(/\.?\s*$/, "")}. ` : ""}${a}.` }));
  const save = () => {
    const input: CareInput = {
      farmId: f.id, scope, reason, species: sp, count: total, date: v.date, vetId: v.vetId || user!.id, missionId: v.missionId || undefined,
      animalId: scope === "animal" && animalId !== "__new" ? animalId || undefined : undefined,
      newAnimal: scope === "animal" && animalId === "__new" ? { tag: newA.tag, name: newA.name || undefined, species: sp, sex: newA.sex || undefined, ageText: newA.ageText || undefined, lotId: newA.lotId || undefined } : undefined,
      lotId: scope === "lot" ? lotId : scope === "animal" ? (animalId === "__new" ? newA.lotId : f.animals?.find((a) => a.id === animalId)?.lotId) || undefined : undefined,
      complaint: v.complaint, exam: { temperature: Number.isFinite(v.temperature) ? v.temperature : undefined, heartRate: Number.isFinite(v.heartRate) ? v.heartRate : undefined, respRate: Number.isFinite(v.respRate) ? v.respRate : undefined, findings: v.findings },
      diagnosis: v.diagnosis, advice: v.advice, nextCheckDays: v.nextDays, addToVisit: v.addToVisit, parentId: prefill.parent?.id,
      treatments: lines.map((l) => ({ product: l.product, productId: db.products.find((p) => p.name.toLowerCase() === l.product.trim().toLowerCase())?.id, dose: l.dose || undefined, route: l.route || undefined, duration: l.duration || undefined, count: scope === "animal" ? 1 : l.count || total })),
    };
    const r = run(openCareCase, input);
    if (r.ok && r.data) {
      onSaved?.(r.data);
      onClose();
    }
  };
  const inp = "h-9 w-full rounded-lg border border-gray-300 bg-transparent px-2.5 text-sm text-gray-800 dark:border-gray-700 dark:text-white/90";
  return (
    <AppModal
      isOpen
      onClose={onClose}
      size="xl"
      title={prefill.parent ? `Étendre la prise en charge (${prefill.parent.code})` : "Consultation et prise en charge"}
      description={`${f.name} · ${f.managerName}`}
      footer={<><Button size="sm" variant="outline" onClick={onClose}>Annuler</Button><Button size="sm" onClick={save}>Enregistrer la prise en charge</Button></>}
    >
      <div className="space-y-5">
        <section className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-800 dark:text-white/90">1. Pourquoi ?</h4>
          <Seg value={reason} onChange={(r) => { setReason(r); setV((x) => ({ ...x, nextDays: CARE_REASON[r].days })); if (r === "pathologie" && scope === "animal") setScopeX("cheptel"); }} options={(Object.keys(CARE_REASON) as CareReason[]).map((k) => ({ v: k, label: CARE_REASON[k].label, hint: CARE_REASON[k].hint, emoji: CARE_REASON[k].emoji }))} />
        </section>

        <section className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-800 dark:text-white/90">2. Pour quels animaux ?</h4>
          <div className="flex flex-wrap gap-1.5">
            {(species.length ? species : [...HERD]).map((s) => (
              <button key={s} type="button" aria-pressed={sp === s} onClick={() => { setSp(s); setAnimalId(""); setLotId(""); if (scope === "cheptel") setCount(speciesHeadcount(f, s, speciesOf) || 1); }} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm", sp === s ? "border-orange-500 bg-orange-500 text-white" : "border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-300")}>
                <SpeciesIcon species={s} />{s}
              </button>
            ))}
          </div>
          <Seg value={scope} onChange={setScopeX} options={(Object.keys(CARE_SCOPE) as CareScope[]).map((k) => ({ v: k, label: CARE_SCOPE[k] }))} />
          {scope === "animal" && (
            <div className="space-y-2 rounded-2xl bg-gray-50 p-3 dark:bg-white/5">
              <SelectField label="Animal" value={animalId} onChange={setAnimalId} options={[...animals.map((a) => ({ value: a.id, label: `n° ${a.tag}${a.name ? ` · ${a.name}` : ""}${a.sex ? ` · ${a.sex === "male" ? "mâle" : "femelle"}` : ""}${a.ageText ? ` · ${a.ageText}` : ""}` })), { value: "__new", label: "+ Identifier un nouvel animal" }]} placeholder={animals.length ? "Choisir l'animal" : "Aucun animal identifié : en identifier un"} />
              {animalId === "__new" && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <input className={inp} value={newA.tag} onChange={(e) => setNewA({ ...newA, tag: e.target.value })} placeholder="N° boucle *" aria-label="Numéro de boucle" />
                  <input className={inp} value={newA.name} onChange={(e) => setNewA({ ...newA, name: e.target.value })} placeholder="Nom (facultatif)" aria-label="Nom" />
                  <select className={cn(inp, "dark:bg-gray-900")} value={newA.sex} onChange={(e) => setNewA({ ...newA, sex: e.target.value as "" | "male" | "femelle" })} aria-label="Sexe"><option value="">Sexe</option><option value="femelle">Femelle</option><option value="male">Mâle</option></select>
                  <input className={inp} value={newA.ageText} onChange={(e) => setNewA({ ...newA, ageText: e.target.value })} placeholder="Âge (ex. 2 ans)" aria-label="Âge" />
                  <select className={cn(inp, "dark:bg-gray-900")} value={newA.lotId} onChange={(e) => setNewA({ ...newA, lotId: e.target.value })} aria-label="Lot"><option value="">Lot (facultatif)</option>{lots.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
                </div>
              )}
            </div>
          )}
          {scope === "lot" && (
            <FormGrid>
              <SelectField label="Bande / lot" value={lotId} onChange={(x) => { setLotId(x); setCount(lotHeadcount(f, x) || 1); }} options={lots.map((l) => ({ value: l.id, label: `${l.name} · ${lotHeadcount(f, l.id)} animaux` }))} placeholder={lots.length ? "Choisir" : "Aucun lot pour cette espèce"} />
              <NumberField label="Animaux concernés" value={count} onChange={setCount} min={1} />
            </FormGrid>
          )}
          {scope === "cheptel" && <NumberField label={`Animaux concernés (effectif ${sp.toLowerCase()} : ${speciesHeadcount(f, sp, speciesOf)})`} value={count} onChange={setCount} min={1} />}
        </section>

        <section className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-800 dark:text-white/90">3. Examen et diagnostic</h4>
          <TextAreaField label={reason === "appel" ? "Motif de l'appel / symptômes" : "Motif"} value={v.complaint} onChange={(x) => setV({ ...v, complaint: x })} rows={2} placeholder="Ex. : ne mange plus depuis 2 jours, boiterie, diarrhée, toux…" />
          <FormGrid cols={3}>
            <NumberField label="Température" suffix="°C" value={v.temperature} onChange={(x) => setV({ ...v, temperature: x })} step={0.1} />
            <NumberField label="Fréq. cardiaque" suffix="/min" value={v.heartRate} onChange={(x) => setV({ ...v, heartRate: x })} />
            <NumberField label="Fréq. respiratoire" suffix="/min" value={v.respRate} onChange={(x) => setV({ ...v, respRate: x })} />
          </FormGrid>
          <TextAreaField label="Constatations à l'examen" value={v.findings} onChange={(x) => setV({ ...v, findings: x })} rows={2} />
          <TextField label="Diagnostic (ou suspicion)" value={v.diagnosis} onChange={(x) => setV({ ...v, diagnosis: x })} />
        </section>

        <section className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-800 dark:text-white/90">4. Traitement</h4>
          <datalist id="care-products">{db.products.filter((p) => p.status === "actif").map((p) => <option key={p.id} value={p.name} />)}</datalist>
          <datalist id="care-routes">{ROUTES.map((r) => <option key={r} value={r} />)}</datalist>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-[1.6fr_1fr_1fr_1fr_5rem_auto]">
              <input list="care-products" className={cn(inp, "col-span-2 sm:col-span-1")} value={l.product} onChange={(e) => setLines(lines.map((x, k) => (k === i ? { ...x, product: e.target.value } : x)))} placeholder="Produit / molécule" aria-label="Produit" />
              <input className={inp} value={l.dose} onChange={(e) => setLines(lines.map((x, k) => (k === i ? { ...x, dose: e.target.value } : x)))} placeholder="Dose (ex. 1 mL/10 kg)" aria-label="Dose" />
              <input list="care-routes" className={inp} value={l.route} onChange={(e) => setLines(lines.map((x, k) => (k === i ? { ...x, route: e.target.value } : x)))} placeholder="Voie" aria-label="Voie" />
              <input className={inp} value={l.duration} onChange={(e) => setLines(lines.map((x, k) => (k === i ? { ...x, duration: e.target.value } : x)))} placeholder="Durée (ex. 3 j)" aria-label="Durée" />
              <input type="number" min={1} className={inp} value={scope === "animal" ? 1 : l.count} disabled={scope === "animal"} onChange={(e) => setLines(lines.map((x, k) => (k === i ? { ...x, count: Number(e.target.value) } : x)))} aria-label="Animaux traités" title="Animaux traités" />
              <Button size="xs" variant="ghost" onClick={() => setLines(lines.length > 1 ? lines.filter((_, k) => k !== i) : [{ ...LINE }])} aria-label="Retirer la ligne">✕</Button>
            </div>
          ))}
          <Button size="xs" variant="soft" onClick={() => setLines([...lines, { ...LINE, count: total }])}>+ Ajouter un produit</Button>
        </section>

        <section className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-800 dark:text-white/90">5. Conseils et recommandations à l&apos;éleveur</h4>
          <div className="flex flex-wrap gap-1.5">{ADVICE_CHIPS.map((a) => <button key={a} type="button" onClick={() => addAdvice(a)} className="rounded-full border border-dashed border-gray-300 px-2.5 py-1 text-theme-xs text-gray-600 hover:border-orange-400 dark:border-gray-700 dark:text-gray-400">+ {a}</button>)}</div>
          <TextAreaField label="Conseils" value={v.advice} onChange={(x) => setV({ ...v, advice: x })} rows={3} />
        </section>

        <section className="space-y-3 rounded-2xl bg-orange-25 p-3 dark:bg-orange-500/5">
          <h4 className="text-sm font-semibold text-gray-800 dark:text-white/90">6. Suivi</h4>
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <span className="text-gray-700 dark:text-gray-300">Prendre des nouvelles dans</span>
            {[1, 2, 3, 7, 14, 30].map((dd) => <button key={dd} type="button" aria-pressed={v.nextDays === dd} onClick={() => setV({ ...v, nextDays: dd })} className={cn("rounded-full border px-2.5 py-1", v.nextDays === dd ? "border-orange-500 bg-orange-500 text-white" : "border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-transparent dark:text-gray-300")}>{dd} j</button>)}
          </div>
          <FormGrid>
            <TextField label="Date" type="date" value={v.date} onChange={(x) => setV({ ...v, date: x })} />
            <SelectField label="Vétérinaire" value={v.vetId} onChange={(x) => setV({ ...v, vetId: x })} options={opts.staff} placeholder="Moi" allowEmpty />
            {missions.length > 0 && <SelectField label="Mission / visite en cours" value={v.missionId} onChange={(x) => setV({ ...v, missionId: x })} options={missions.map((m) => ({ value: m.id, label: `${m.code} · ${m.objective}` }))} allowEmpty placeholder="Aucune" className="sm:col-span-2" />}
          </FormGrid>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><input type="checkbox" checked={v.addToVisit} onChange={(e) => setV({ ...v, addToVisit: e.target.checked })} className="size-4 accent-orange-500" />Consigner dans le rapport de visite du jour</label>
        </section>
      </div>
    </AppModal>
  );
}
