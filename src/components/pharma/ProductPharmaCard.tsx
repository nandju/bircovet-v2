"use client";

import AppModal from "@/components/common/AppModal";
import ComponentCard from "@/components/common/ComponentCard";
import { CheckField, FormGrid, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { Link } from "@/i18n/navigation";
import { CONC_UNITS, type ConcUnit } from "@/lib/pharma/compute";
import { norm } from "@/lib/pharma/model";
import { allMolecules, findMolecule } from "@/lib/pharma/state";
import { SHELVES, shelfLabel } from "@/lib/pharma/shelves";
import { updateProduct } from "@/lib/services/inventoryService";
import type { Product } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

type Form = Pick<Product, "brandName" | "laboratory" | "activeIngredient" | "excipients" | "indications" | "posologie" | "contraIndications" | "humanUse" | "concentration" | "composition" | "withdrawalMeatDays" | "withdrawalMilkDays" | "shelf" | "targetSpecies" | "routes" | "vial">;

const ROUTES = ["IV", "IM", "SC", "PO", "IR", "Topique", "Ophtalmo.", "Intramammaire", "Eau de boisson"];

function PharmaModal({ product, isOpen, onClose }: { product: Product; isOpen: boolean; onClose: () => void }) {
  const { db, run } = useDemo();
  const [v, setV] = useState<Form>({});
  const [q, setQ] = useState("");
  const molecules = useMemo(() => allMolecules(db), [db]);
  useEffect(() => {
    if (isOpen) {
      const { brandName, laboratory, activeIngredient, excipients, indications, posologie, contraIndications, humanUse, concentration, composition, withdrawalMeatDays, withdrawalMilkDays, shelf, targetSpecies, routes, vial } = product;
      setV({ brandName, laboratory, activeIngredient, excipients, indications, posologie, contraIndications, humanUse, concentration, composition: composition ?? [], withdrawalMeatDays, withdrawalMilkDays, shelf, targetSpecies, routes, vial });
      setQ("");
    }
  }, [isOpen, product]);
  const needle = norm(q.trim());
  const hits = needle.length >= 2 ? molecules.filter((m) => norm(`${m.name} ${m.synonyms.join(" ")}`).includes(needle) && !v.composition?.some((c) => c.moleculeId === m.id)).slice(0, 6) : [];
  const n = (s: string) => (s.trim() === "" ? undefined : Number(s.replace(",", ".")));
  const save = () => {
    const names = (v.composition ?? []).map((c) => findMolecule(db, c.moleculeId)?.name).filter(Boolean).join(" + ");
    const r = run(updateProduct, { id: product.id, patch: { ...v, activeIngredient: v.activeIngredient || names || undefined } });
    if (r.ok) onClose();
  };
  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title="Fiche pharmaceutique"
      description={product.name}
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={save}>Enregistrer</Button>
        </>
      }
    >
      <div className="space-y-5">
        <FormGrid>
          <TextField label="Nom déposé / commercial" value={v.brandName ?? ""} onChange={(x) => setV({ ...v, brandName: x || undefined })} placeholder="Ex. : Baytril® 5 %" />
          <TextField label="Laboratoire" value={v.laboratory ?? ""} onChange={(x) => setV({ ...v, laboratory: x || undefined })} />
          <SelectField label="Rayon (vue générale)" value={v.shelf ?? ""} onChange={(x) => setV({ ...v, shelf: x || undefined })} options={SHELVES.map((s) => ({ value: s.key, label: `${s.group} · ${s.label}` }))} allowEmpty placeholder="Non classé" />
          <TextField label="Espèces ciblées" value={v.targetSpecies ?? ""} onChange={(x) => setV({ ...v, targetSpecies: x || undefined })} />
        </FormGrid>

        <div>
          <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-400">Molécule(s) / principe(s) actif(s)</p>
          <ul className="mb-2 flex flex-wrap gap-1.5">
            {(v.composition ?? []).map((c) => (
              <li key={c.moleculeId} className="flex items-center gap-1.5 rounded-full bg-brand-50 py-1 ps-3 pe-1 text-sm text-brand-800 dark:bg-brand-500/15 dark:text-brand-200">
                {findMolecule(db, c.moleculeId)?.name ?? c.moleculeId}
                <input aria-label="Quantité par unité" inputMode="decimal" value={c.amount ?? ""} onChange={(e) => setV({ ...v, composition: v.composition!.map((x) => (x.moleculeId === c.moleculeId ? { ...x, amount: n(e.target.value) } : x)) })} placeholder="qté" className="h-6 w-14 rounded-md border border-brand-200 bg-white px-1 text-theme-xs dark:border-brand-800 dark:bg-gray-900" />
                <input aria-label="Unité" value={c.unit ?? ""} onChange={(e) => setV({ ...v, composition: v.composition!.map((x) => (x.moleculeId === c.moleculeId ? { ...x, unit: e.target.value } : x)) })} placeholder="mg" className="h-6 w-14 rounded-md border border-brand-200 bg-white px-1 text-theme-xs dark:border-brand-800 dark:bg-gray-900" />
                <button type="button" aria-label="Retirer" onClick={() => setV({ ...v, composition: v.composition!.filter((x) => x.moleculeId !== c.moleculeId) })} className="rounded-full px-1.5 text-brand-600 hover:bg-brand-100 dark:hover:bg-brand-500/20">×</button>
              </li>
            ))}
          </ul>
          <div className="relative">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ajouter une molécule de l'Index (ex. : enrofloxacine)" aria-label="Ajouter une molécule" className="h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-700 dark:text-white/90" />
            {hits.length > 0 && (
              <ul className="absolute inset-x-0 top-full z-20 mt-1 rounded-xl border border-gray-200 bg-white p-1 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900">
                {hits.map((m) => (
                  <li key={m.id}>
                    <button type="button" onClick={() => { setV({ ...v, composition: [...(v.composition ?? []), { moleculeId: m.id }] }); setQ(""); }} className="w-full rounded-lg px-3 py-2 text-start text-sm hover:bg-gray-50 dark:hover:bg-white/5">
                      {m.name} <span className="text-theme-xs text-gray-500">{m.synonyms.join(", ")}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="mt-1 text-[11px] text-gray-500">Molécule absente ? Créez-la dans Pharmacie → Index des molécules → Nouvelle fiche.</p>
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-400">Voies autorisées pour ce produit</p>
          <div className="flex flex-wrap gap-1.5">
            {ROUTES.map((r) => {
              const on = !!v.routes?.includes(r);
              return <button key={r} type="button" aria-pressed={on} onClick={() => setV({ ...v, routes: on ? v.routes!.filter((x) => x !== r) : [...(v.routes ?? []), r] })} className={on ? "rounded-full border border-brand-500 bg-brand-50 px-3 py-1 text-sm font-medium text-brand-800 dark:bg-brand-500/15 dark:text-brand-200" : "rounded-full border border-gray-200 px-3 py-1 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300"}>{r}</button>;
            })}
          </div>
          <p className="mt-1 text-[11px] text-gray-500">Le calculateur prévient si la voie recommandée par l&apos;index n&apos;est pas une voie du produit (ex. forme IV uniquement).</p>
        </div>

        <div className="rounded-2xl border border-gray-200 p-3 dark:border-gray-700">
          <CheckField label="Poudre à reconstituer (flacon)" checked={!!v.vial} onChange={(x) => setV({ ...v, vial: x ? { volumeMl: 20, components: (v.composition ?? []).length ? (v.composition ?? []).map((c) => ({ name: findMolecule(db, c.moleculeId)?.name ?? c.moleculeId, mg: c.amount ?? 0 })) : [{ name: "", mg: 0 }] } : undefined })} />
          {v.vial && (
            <div className="mt-3 space-y-2">
              {v.vial.components.map((c, i) => (
                <div key={i} className="grid grid-cols-[1fr_7rem_auto] items-center gap-2">
                  <input aria-label="Principe actif du flacon" value={c.name} onChange={(e) => setV({ ...v, vial: { ...v.vial!, components: v.vial!.components.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) } })} placeholder="Ex. Amoxicilline" className="h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-700 dark:text-white/90" />
                  <input aria-label="Quantité en mg" inputMode="decimal" value={c.mg || ""} onChange={(e) => setV({ ...v, vial: { ...v.vial!, components: v.vial!.components.map((x, j) => (j === i ? { ...x, mg: n(e.target.value) ?? 0 } : x)) } })} placeholder="mg" className="h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-700 dark:text-white/90" />
                  <button type="button" aria-label="Retirer ce composant" onClick={() => setV({ ...v, vial: { ...v.vial!, components: v.vial!.components.filter((_, j) => j !== i) } })} className="rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5">×</button>
                </div>
              ))}
              <button type="button" onClick={() => setV({ ...v, vial: { ...v.vial!, components: [...v.vial!.components, { name: "", mg: 0 }] } })} className="text-theme-sm font-medium text-brand-600 hover:underline dark:text-brand-400">Ajouter un principe actif</button>
              <FormGrid>
                <TextField label="Volume après reconstitution (mL)" value={v.vial.volumeMl?.toString() ?? ""} onChange={(x) => setV({ ...v, vial: { ...v.vial!, volumeMl: n(x) ?? 0 } })} hint="Selon la notice du produit" />
                <TextField label="Conservation après reconstitution" value={v.vial.note ?? ""} onChange={(x) => setV({ ...v, vial: { ...v.vial!, note: x || undefined } })} placeholder="Ex. utiliser immédiatement" />
              </FormGrid>
            </div>
          )}
        </div>

        <FormGrid>
          <div className="grid grid-cols-[1fr_auto] items-end gap-2">
            <TextField label="Concentration / dosage" value={v.concentration?.value?.toString() ?? ""} onChange={(x) => setV({ ...v, concentration: x ? { value: Number(x.replace(",", ".")), unit: v.concentration?.unit ?? "mg/mL" } : undefined })} hint="Utilisée par le calculateur" />
            <select aria-label="Unité de concentration" value={v.concentration?.unit ?? "mg/mL"} onChange={(e) => v.concentration && setV({ ...v, concentration: { ...v.concentration, unit: e.target.value as ConcUnit } })} className="mb-6 h-11 rounded-lg border border-gray-300 bg-transparent px-2 text-sm dark:border-gray-700 dark:text-white/90">
              {CONC_UNITS.map((u) => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div className="pt-7">
            <CheckField label="Spécialité à usage humain (hors AMM vétérinaire)" checked={!!v.humanUse} onChange={(x) => setV({ ...v, humanUse: x })} />
          </div>
          <TextField label="Délai d'attente viande (jours)" value={v.withdrawalMeatDays?.toString() ?? ""} onChange={(x) => setV({ ...v, withdrawalMeatDays: n(x) })} hint="Étiquette du produit — animaux de rente" />
          <TextField label="Délai d'attente lait (jours)" value={v.withdrawalMilkDays?.toString() ?? ""} onChange={(x) => setV({ ...v, withdrawalMilkDays: n(x) })} />
          <TextAreaField label="Excipients" value={v.excipients ?? ""} onChange={(x) => setV({ ...v, excipients: x || undefined })} rows={2} />
          <TextAreaField label="Indications" value={v.indications ?? ""} onChange={(x) => setV({ ...v, indications: x || undefined })} rows={2} />
          <TextAreaField label="Posologie recommandée par le fabricant" value={v.posologie ?? ""} onChange={(x) => setV({ ...v, posologie: x || undefined })} rows={2} />
          <TextAreaField label="Contre-indications" value={v.contraIndications ?? ""} onChange={(x) => setV({ ...v, contraIndications: x || undefined })} rows={2} />
        </FormGrid>
      </div>
    </AppModal>
  );
}

function Row({ k, v }: { k: string; v?: React.ReactNode }) {
  if (!v) return null;
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-3 py-1.5 text-sm max-sm:grid-cols-1 max-sm:gap-0.5">
      <dt className="text-gray-500 dark:text-gray-400">{k}</dt>
      <dd className="text-gray-800 dark:text-gray-200">{v}</dd>
    </div>
  );
}

export default function ProductPharmaCard({ product }: { product: Product }) {
  const { db, can } = useDemo();
  const [open, setOpen] = useState(false);
  const comp = product.composition ?? [];
  const first = comp[0]?.moleculeId;
  return (
    <ComponentCard
      title="Fiche pharmaceutique"
      className="lg:col-span-3"
      actions={
        <>
          {first && <Link href={`/stock/calculateur?molecule=${first}&produit=${product.id}`} className="inline-flex h-8 items-center rounded-lg bg-brand-500 px-3 text-theme-xs font-medium text-white hover:bg-brand-600">Posologie et calcul</Link>}
          {can("stock", "update") && <Button size="xs" variant="outline" onClick={() => setOpen(true)}>Modifier</Button>}
        </>
      }
    >
      {product.humanUse && <p className="rounded-lg bg-warning-50 px-3 py-2 text-theme-xs text-warning-800 dark:bg-warning-500/10 dark:text-warning-300">Usage hors AMM vétérinaire, sous la responsabilité du prescripteur.</p>}
      <dl className="divide-y divide-gray-100 dark:divide-gray-800">
        <Row k="Nom déposé / commercial" v={product.brandName ?? product.name} />
        <Row k="Laboratoire" v={product.laboratory} />
        <Row
          k="Molécule(s)"
          v={
            comp.length ? (
              <span className="flex flex-wrap gap-2">
                {comp.map((c) => (
                  <Link key={c.moleculeId} href={`/stock/molecules/${c.moleculeId}`} className="text-brand-600 underline dark:text-brand-400">
                    {findMolecule(db, c.moleculeId)?.name ?? c.moleculeId}
                    {c.amount ? ` ${c.amount} ${c.unit ?? ""}` : ""}
                  </Link>
                ))}
              </span>
            ) : (
              product.activeIngredient ?? <span className="text-gray-400">Non reliée à l&apos;Index des molécules</span>
            )
          }
        />
        <Row k="Concentration" v={product.concentration ? `${product.concentration.value} ${product.concentration.unit}` : undefined} />
        <Row k="Voies autorisées" v={product.routes?.length ? product.routes.join(", ") : undefined} />
        <Row k="Flacon à reconstituer" v={product.vial ? `${product.vial.components.map((c) => `${c.name} ${c.mg} mg`).join(" + ")} dans ${product.vial.volumeMl} mL${product.vial.note ? ` · ${product.vial.note}` : ""}` : undefined} />
        <Row k="Excipients" v={product.excipients} />
        <Row k="Indications" v={product.indications} />
        <Row k="Posologie (fabricant)" v={product.posologie} />
        <Row k="Contre-indications" v={product.contraIndications} />
        <Row k="Délais d'attente" v={product.withdrawalMeatDays != null || product.withdrawalMilkDays != null ? `Viande ${product.withdrawalMeatDays ?? "—"} j · Lait ${product.withdrawalMilkDays ?? "—"} j` : undefined} />
        <Row k="Rayon" v={product.shelf ? shelfLabel(product.shelf) : undefined} />
      </dl>
      <PharmaModal product={product} isOpen={open} onClose={() => setOpen(false)} />
    </ComponentCard>
  );
}
