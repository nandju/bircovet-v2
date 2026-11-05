"use client";

import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { uid } from "@/lib/format";
import { allSources, DEFAULT_FAMILIES, FAMILY_COLORS } from "@/lib/revenue";
import { saveRevenueFamilies } from "@/lib/services/adminService";
import type { RevenueFamily } from "@/lib/types";
import { cn } from "@/utils";
import { useState } from "react";

const inp = "h-9 rounded-lg border border-gray-300 bg-transparent px-2.5 text-sm text-gray-800 dark:border-gray-700 dark:text-white/90";

/** Le DG crée ses familles de recettes et y range chaque type d'acte et catégorie de produits. */
export default function FamiliesEditor({ onDone }: { onDone: () => void }) {
  const { db, run } = useDemo();
  const [fams, setFams] = useState<RevenueFamily[]>(() => structuredClone(db.settings.revenueFamilies?.length ? db.settings.revenueFamilies : DEFAULT_FAMILIES));
  const sources = allSources();
  const familyOf = (key: string) => fams.find((f) => f.keys.includes(key))?.id ?? "";
  const assign = (key: string, famId: string) => setFams(fams.map((f) => ({ ...f, keys: f.id === famId ? [...f.keys.filter((k) => k !== key), key] : f.keys.filter((k) => k !== key) })));
  const patch = (id: string, p: Partial<RevenueFamily>) => setFams(fams.map((f) => (f.id === id ? { ...f, ...p } : f)));
  const colors = Object.keys(FAMILY_COLORS);
  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-gray-200/70 bg-white p-5 shadow-cliva dark:border-gray-800 dark:bg-white/3">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">1. Vos familles de recettes</h3>
        <p className="mb-3 text-theme-sm text-gray-500">Nommez les grands pans de votre activité. L&apos;objectif mensuel est facultatif.</p>
        <ul className="space-y-2">
          {fams.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1" role="radiogroup" aria-label={`Couleur de ${f.name}`}>
                {colors.map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={f.color === c} aria-label={c} onClick={() => patch(f.id, { color: c })} className={cn("size-5 rounded-full", FAMILY_COLORS[c].dot, f.color === c ? "ring-2 ring-gray-900 ring-offset-1 dark:ring-white" : "opacity-60")} />
                ))}
              </div>
              <input value={f.name} onChange={(e) => patch(f.id, { name: e.target.value })} className={cn(inp, "min-w-52 flex-1")} aria-label="Nom de la famille" />
              <input type="number" min={0} step={50000} value={f.monthlyTarget ?? ""} onChange={(e) => patch(f.id, { monthlyTarget: e.target.value ? Number(e.target.value) : undefined })} placeholder="Objectif / mois (FCFA)" className={cn(inp, "w-48")} aria-label="Objectif mensuel" />
              <Button size="xs" variant="ghost" className="text-error-600" onClick={() => setFams(fams.filter((x) => x.id !== f.id))}>Supprimer</Button>
            </li>
          ))}
        </ul>
        <Button size="sm" variant="soft" className="mt-3" onClick={() => setFams([...fams, { id: uid("fam"), name: "Nouvelle famille", color: colors[fams.length % colors.length], keys: [] }])}>+ Ajouter une famille</Button>
      </section>

      <section className="rounded-3xl border border-gray-200/70 bg-white p-5 shadow-cliva dark:border-gray-800 dark:bg-white/3">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">2. Rangez chaque source dans une famille</h3>
        <p className="mb-3 text-theme-sm text-gray-500">Les actes sont reconnus d&apos;après leur libellé (ex. « vaccination », « stérilisation ») ; les produits d&apos;après leur catégorie.</p>
        <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
          {(["service", "produit"] as const).map((kind) => (
            <div key={kind}>
              <p className="mb-1 text-theme-xs font-semibold tracking-wide text-gray-500 uppercase">{kind === "service" ? "Actes et prestations" : "Produits vendus"}</p>
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {sources.filter((s) => s.kind === kind).map((s) => {
                  const fid = familyOf(s.key);
                  const fam = fams.find((f) => f.id === fid);
                  return (
                    <li key={s.key} className="flex items-center justify-between gap-2 py-2">
                      <span className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <span className={cn("size-2 rounded-full", fam ? FAMILY_COLORS[fam.color]?.dot : "bg-gray-300")} />
                        {s.label.replace(/^Produits · /, "")}
                      </span>
                      <select value={fid} onChange={(e) => assign(s.key, e.target.value)} className={cn(inp, "h-8 max-w-52 dark:bg-gray-900", !fid && "border-warning-400")} aria-label={`Famille de ${s.label}`}>
                        <option value="">Non classé</option>
                        {fams.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => run(saveRevenueFamilies, { families: fams }).ok && onDone()}>Enregistrer</Button>
        <Button variant="outline" onClick={() => setFams(structuredClone(DEFAULT_FAMILIES))}>Revenir au classement proposé</Button>
        <Button variant="ghost" onClick={onDone}>Annuler</Button>
      </div>
    </div>
  );
}
