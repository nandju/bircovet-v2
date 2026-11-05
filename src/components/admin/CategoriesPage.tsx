"use client";

import ComponentCard from "@/components/common/ComponentCard";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { normalize } from "@/lib/format";
import { labelOf, optionsOf } from "@/lib/labels";
import { saveCategories } from "@/lib/services/adminService";
import { useState } from "react";

const inp = "h-9 w-full rounded-lg border border-gray-300 bg-transparent px-2.5 text-sm dark:border-gray-700 dark:text-white/90";

function Chips({ items, onChange, disabled, placeholder }: { items: string[]; onChange: (v: string[]) => void; disabled?: boolean; placeholder: string }) {
  const [x, setX] = useState("");
  const add = () => {
    const v = x.trim();
    if (v && !items.includes(v)) onChange([...items, v]);
    setX("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map((it) => (
        <span key={it} className="inline-flex items-center gap-1 rounded-full bg-gray-100 py-0.5 ps-2.5 pe-1.5 text-theme-xs text-gray-700 dark:bg-white/10 dark:text-gray-300">
          {it}
          {!disabled && <button type="button" aria-label={`Retirer ${it}`} onClick={() => onChange(items.filter((y) => y !== it))} className="text-gray-400 hover:text-error-600">✕</button>}
        </span>
      ))}
      {!disabled && (
        <input value={x} onChange={(e) => setX(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} onBlur={add} placeholder={placeholder} className="h-7 min-w-36 flex-1 rounded-full border border-dashed border-gray-300 bg-transparent px-2.5 text-theme-xs dark:border-gray-700" />
      )}
    </div>
  );
}

/** Le DG renomme les catégories et ajoute des précisions (sous-catégories) utilisées dans les fiches. */
export default function CategoriesPage() {
  const { db, run, user } = useDemo();
  const isDG = user?.roleId === "dg";
  const [cats, setCats] = useState<string[]>(() => optionsOf("category").map((o) => o.value));
  const [reassign, setReassign] = useState<Record<string, string>>({});
  const [removed, setRemoved] = useState<string[]>([]);
  const [newCat, setNewCat] = useState("");
  const nameOf = (c: string) => labels[c] || labelOf("category", c);
  const addCat = () => {
    const name = newCat.trim();
    if (!name) return;
    const base = normalize(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "categorie";
    let code = base;
    for (let i = 2; cats.includes(code) || removed.includes(code); i++) code = `${base}-${i}`;
    setCats([...cats, code]);
    setLabels({ ...labels, [code]: name });
    setNewCat("");
  };
  const removeCat = (c: string) => {
    setCats(cats.filter((x) => x !== c));
    setRemoved([...removed, c]);
  };
  const restoreCat = (c: string) => {
    setRemoved(removed.filter((x) => x !== c));
    setCats([...cats, c]);
  };
  const move = (c: string, dir: -1 | 1) => {
    const i = cats.indexOf(c);
    const j = i + dir;
    if (j < 0 || j >= cats.length) return;
    const n = [...cats];
    [n[i], n[j]] = [n[j], n[i]];
    setCats(n);
  };
  const [labels, setLabels] = useState<Record<string, string>>(() => ({ ...(db.settings.categoryLabels ?? {}) }));
  const [details, setDetails] = useState<Record<string, string[]>>(() => ({ ...(db.settings.categoryDetails ?? {}) }));
  const [exp, setExp] = useState<string[]>(() => [...db.settings.expenseCategories]);
  const [expDetails, setExpDetails] = useState<Record<string, string[]>>(() => ({ ...(db.settings.expenseDetails ?? {}) }));
  const [newExp, setNewExp] = useState("");
  const used = (c: string) => db.products.filter((p) => p.category === c).length;
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb
        pageTitle="Catégories et précisions"
        subtitle="Renommez les catégories et ajoutez des précisions (ex. Vaccins → Volaille, Chien) proposées dans les fiches produits et dépenses"
        trail={[{ label: "Administration", href: "/administration/parametres" }]}
        actions={isDG && <Button size="sm" onClick={() => run(saveCategories, { labels, details, expenseCategories: exp, expenseDetails: expDetails, productCategories: cats, reassign })}>Enregistrer</Button>}
      />
      {!isDG && <p className="text-sm text-gray-500">Consultation seule : seul le DG modifie les catégories.</p>}
      <ComponentCard title="Catégories de produits (pharmacie et stock)" desc="Ajoutez, renommez, rangez ou supprimez vos catégories. Pour fusionner deux catégories, supprimez-en une et déplacez ses produits dans l'autre.">
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {cats.map((c, i) => (
            <li key={c} className="grid grid-cols-1 gap-2 py-3 md:grid-cols-[16rem_1fr_auto]">
              <div>
                <input aria-label={`Nom de la catégorie ${nameOf(c)}`} value={labels[c] ?? ""} placeholder={labelOf("category", c)} disabled={!isDG} onChange={(e) => setLabels({ ...labels, [c]: e.target.value })} className={inp} />
                <p className="mt-0.5 text-[11px] text-gray-500">{used(c)} produit(s)</p>
              </div>
              <Chips items={details[c] ?? []} onChange={(v) => setDetails({ ...details, [c]: v })} disabled={!isDG} placeholder="+ précision (Entrée)" />
              {isDG && (
                <div className="flex items-start gap-1">
                  <Button size="xs" variant="ghost" onClick={() => move(c, -1)} disabled={i === 0} aria-label="Monter">↑</Button>
                  <Button size="xs" variant="ghost" onClick={() => move(c, 1)} disabled={i === cats.length - 1} aria-label="Descendre">↓</Button>
                  <Button size="xs" variant="ghost" className="text-error-600" onClick={() => removeCat(c)} disabled={cats.length <= 1}>Supprimer</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
        {removed.length > 0 && (
          <div className="space-y-2 rounded-2xl border border-warning-200 bg-warning-50 p-3 dark:border-warning-500/30 dark:bg-warning-500/10">
            <p className="text-theme-sm font-medium text-warning-800 dark:text-warning-300">Catégories supprimées (appliqué à l&apos;enregistrement)</p>
            {removed.map((c) => (
              <div key={c} className="flex flex-wrap items-center gap-2 text-theme-sm text-gray-700 dark:text-gray-300">
                <span className="font-medium">{nameOf(c)}</span>
                {used(c) > 0 ? (
                  <>
                    <span>— déplacer ses {used(c)} produit(s) vers</span>
                    <select value={reassign[c] ?? ""} onChange={(e) => setReassign({ ...reassign, [c]: e.target.value })} className="h-8 rounded-lg border border-gray-300 bg-white px-2 text-sm dark:border-gray-700 dark:bg-gray-900" aria-label={`Déplacer les produits de ${nameOf(c)}`}>
                      <option value="">Choisir…</option>
                      {cats.map((x) => <option key={x} value={x}>{nameOf(x)}</option>)}
                    </select>
                  </>
                ) : (
                  <span className="text-gray-500">— aucun produit</span>
                )}
                <Button size="xs" variant="ghost" onClick={() => restoreCat(c)}>Annuler</Button>
              </div>
            ))}
          </div>
        )}
        {isDG && (
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); addCat(); }}>
            <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Nouvelle catégorie de produits (ex. : Accessoires, Hygiène…)" className={inp} />
            <Button size="sm" type="submit" variant="soft">Ajouter</Button>
          </form>
        )}
      </ComponentCard>
      <ComponentCard title="Catégories de dépenses">
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {exp.map((c, i) => (
            <li key={i} className="grid grid-cols-1 gap-2 py-3 md:grid-cols-[16rem_1fr_auto]">
              <input aria-label="Catégorie" value={c} disabled={!isDG} onChange={(e) => { const v = e.target.value; setExpDetails((m) => { const n = { ...m, [v]: m[c] ?? [] }; delete n[c]; return n; }); setExp(exp.map((x, k) => (k === i ? v : x))); }} className={inp} />
              <Chips items={expDetails[c] ?? []} onChange={(v) => setExpDetails({ ...expDetails, [c]: v })} disabled={!isDG} placeholder="+ précision (Entrée)" />
              {isDG && <Button size="xs" variant="ghost" className="text-error-600" onClick={() => setExp(exp.filter((_, k) => k !== i))}>Retirer</Button>}
            </li>
          ))}
        </ul>
        {isDG && (
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (newExp.trim() && !exp.includes(newExp.trim())) setExp([...exp, newExp.trim()]); setNewExp(""); }}>
            <input value={newExp} onChange={(e) => setNewExp(e.target.value)} placeholder="Nouvelle catégorie de dépense" className={inp} />
            <Button size="sm" type="submit" variant="soft">Ajouter</Button>
          </form>
        )}
      </ComponentCard>
    </div>
  );
}
