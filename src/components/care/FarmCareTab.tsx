"use client";

import ComponentCard from "@/components/common/ComponentCard";
import SpeciesIcon from "@/components/common/SpeciesIcon";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { careTarget } from "@/lib/care";
import { HERD, speciesOf } from "@/lib/farmProfile";
import { registerFarmAnimal } from "@/lib/services/careService";
import type { Farm } from "@/lib/types";
import { cn } from "@/utils";
import { useState } from "react";
import type { CarePrefill } from "./CareCaseModal";
import CareList from "./CareList";

const inp = "h-9 rounded-lg border border-gray-300 bg-transparent px-2.5 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";

export default function FarmCareTab({ farm: f, onNew, onOpen }: { farm: Farm; onNew: (p: CarePrefill) => void; onOpen: (id: string) => void }) {
  const { db, run, can } = useDemo();
  const cases = (db.careCases ?? []).filter((c) => c.farmId === f.id);
  const open = cases.filter((c) => c.status === "en_cours");
  const closed = cases.filter((c) => c.status !== "en_cours");
  const species = [...new Set(f.lots.map((l) => speciesOf(l.species)))];
  const [a, setA] = useState({ tag: "", name: "", species: species[0] ?? "Bovin", sex: "", ageText: "", lotId: "" });
  const animals = (f.animals ?? []).filter((x) => x.status === "present");
  const edit = can("exploitations", "update");
  return (
    <div className="space-y-4">
      {edit && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { p: { farmId: f.id, reason: "appel" as const, scope: "animal" as const }, e: "📞", t: "Un animal ne va pas", h: "Examen et traitement" },
            { p: { farmId: f.id, reason: "visite_routine" as const, scope: "cheptel" as const }, e: "🔎", t: "Visite de routine", h: "Contrôle du cheptel" },
            { p: { farmId: f.id, reason: "traitement_routine" as const, scope: "cheptel" as const }, e: "💉", t: "Traitement de routine", h: "Vaccin, déparasitage…" },
            { p: { farmId: f.id, reason: "pathologie" as const, scope: "cheptel" as const }, e: "🚨", t: "Prise en charge du cheptel", h: "Après un diagnostic" },
          ].map((x) => (
            <button key={x.t} type="button" onClick={() => onNew(x.p)} className="cliva-press flex items-center gap-3 rounded-2xl border border-orange-200 bg-white px-3 py-3 text-start shadow-cliva hover:border-orange-400 dark:border-orange-500/30 dark:bg-white/3">
              <span aria-hidden className="text-2xl">{x.e}</span>
              <span><span className="block text-sm font-semibold text-gray-800 dark:text-white/90">{x.t}</span><span className="block text-theme-xs text-gray-500">{x.h}</span></span>
            </button>
          ))}
        </div>
      )}
      <ComponentCard title={`Sous prise en charge (${open.length})`}>
        <CareList cases={open} onOpen={onOpen} />
      </ComponentCard>
      <ComponentCard title={`Animaux identifiés (${animals.length})`} desc="Les animaux suivis individuellement (n° de boucle, nom).">
        {animals.length > 0 && (
          <ul className="mb-3 flex flex-wrap gap-2">
            {animals.map((x) => {
              const active = cases.find((c) => c.animalId === x.id && c.status === "en_cours");
              return (
                <li key={x.id}>
                  <button type="button" onClick={() => (active ? onOpen(active.id) : onNew({ farmId: f.id, scope: "animal", reason: "appel", species: x.species, animalId: x.id }))} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm", active ? "border-orange-400 bg-orange-50 text-orange-800 dark:bg-orange-500/10 dark:text-orange-300" : "border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-300")} title={active ? `En cours : ${careTarget(db, active)}` : "Ouvrir une consultation"}>
                    <SpeciesIcon species={x.species} />n° {x.tag}{x.name ? ` · ${x.name}` : ""}{active && " · suivi"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {edit && (
          <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (run(registerFarmAnimal, { farmId: f.id, animal: { tag: a.tag, name: a.name || undefined, species: a.species, sex: (a.sex || undefined) as "male" | "femelle" | undefined, ageText: a.ageText || undefined, lotId: a.lotId || undefined } }).ok) setA({ ...a, tag: "", name: "", ageText: "" }); }}>
            <input className={cn(inp, "w-28")} value={a.tag} onChange={(e) => setA({ ...a, tag: e.target.value })} placeholder="N° boucle" aria-label="Numéro de boucle" />
            <input className={cn(inp, "w-32")} value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} placeholder="Nom" aria-label="Nom" />
            <select className={inp} value={a.species} onChange={(e) => setA({ ...a, species: e.target.value })} aria-label="Espèce">{(species.length ? species : [...HERD]).map((s) => <option key={s}>{s}</option>)}</select>
            <select className={inp} value={a.sex} onChange={(e) => setA({ ...a, sex: e.target.value })} aria-label="Sexe"><option value="">Sexe</option><option value="femelle">Femelle</option><option value="male">Mâle</option></select>
            <input className={cn(inp, "w-28")} value={a.ageText} onChange={(e) => setA({ ...a, ageText: e.target.value })} placeholder="Âge" aria-label="Âge" />
            <Button size="sm" variant="soft" type="submit" disabled={!a.tag.trim()}>Identifier</Button>
          </form>
        )}
      </ComponentCard>
      {closed.length > 0 && (
        <ComponentCard title={`Historique (${closed.length})`}>
          <CareList cases={closed} onOpen={onOpen} />
        </ComponentCard>
      )}
    </div>
  );
}
