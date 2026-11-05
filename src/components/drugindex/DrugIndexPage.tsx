"use client";

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { PrintFrame, PrintHeader } from "@/components/print/PrintSheet";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { PlusIcon, PrinterIcon } from "@/icons";
import { userName } from "@/lib/calc";
import { ABBREVIATIONS, indexOf, normText } from "@/lib/drugIndex";
import { formatDate } from "@/lib/format";
import { removeDrugIndexSource } from "@/lib/services/drugIndexService";
import type { DrugIndexEntry } from "@/lib/types";
import { cn } from "@/utils";
import { useState } from "react";
import DrugIndexEntryModal, { type EntryDraft } from "./DrugIndexEntryModal";
import DrugIndexImport from "./DrugIndexImport";

const sel = "h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";
const letterOf = (m: string) => normText(m).charAt(0).toUpperCase();

/** Regroupe les lignes par molécule, dans l'ordre alphabétique. */
function groupByMolecule(list: DrugIndexEntry[]) {
  const map = new Map<string, DrugIndexEntry[]>();
  for (const e of [...list].sort((a, b) => a.molecule.localeCompare(b.molecule, "fr"))) {
    const k = `${normText(e.molecule)}|${e.species}`;
    map.set(k, [...(map.get(k) ?? []), e]);
  }
  return Array.from(map.values());
}

function IndexTable({ groups, onEdit, print = false }: { groups: DrugIndexEntry[][]; onEdit?: (e: DrugIndexEntry) => void; print?: boolean }) {
  const multiSpecies = new Set(groups.map((g) => g[0].species)).size > 1;
  const th = print ? "py-1 pe-2 text-start font-semibold" : "px-3 py-2.5 text-start text-theme-xs font-medium text-gray-500";
  const td = print ? "py-1 pe-2 align-top" : "px-3 py-2 align-top";
  const firstOfLetter = new Set(groups.filter((g, i) => i === 0 || letterOf(groups[i - 1][0].molecule) !== letterOf(g[0].molecule)).map((g) => g[0].id));
  return (
    <table className={cn("w-full border-collapse", print ? "text-[10px] leading-snug" : "min-w-180 text-theme-sm")}>
      <thead className={print ? "" : "sticky top-0 bg-gray-50 dark:bg-gray-900"}>
        <tr className={print ? "border-b border-gray-900" : ""}>
          {["Molécule", "Indication", "Posologie", "Voie", "AMM"].map((h) => <th key={h} className={th}>{h}</th>)}
          {!print && onEdit && <th className={th}><span className="sr-only">Modifier</span></th>}
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => {
          const anchor = firstOfLetter.has(g[0].id) ? letterOf(g[0].molecule) : null;
          return g.map((e, i) => (
            <tr key={e.id} id={anchor && i === 0 ? `lettre-${anchor}` : undefined} className={cn("break-inside-avoid", i === 0 ? (print ? "border-t border-gray-300" : "border-t border-gray-200 dark:border-gray-800") : "", !print && "scroll-mt-24 hover:bg-gray-50 dark:hover:bg-white/3")}>
              <td className={cn(td, "font-semibold text-gray-800 dark:text-white/90")}>
                {i === 0 && (
                  <>
                    {e.molecule}
                    {multiSpecies && <span className="block text-theme-xs font-normal text-gray-500">{e.species}</span>}
                  </>
                )}
              </td>
              <td className={cn(td, "text-gray-700 dark:text-gray-300")}>{e.indication}</td>
              <td className={cn(td, "tabular-nums text-gray-800 dark:text-white/90")}>{e.dosage}{e.note && <span className="block text-theme-xs text-gray-500">{e.note}</span>}</td>
              <td className={cn(td, "text-gray-700 dark:text-gray-300")}>{e.route}</td>
              <td className={cn(td, "text-gray-600 dark:text-gray-400")}>{e.amm}</td>
              {!print && onEdit && (
                <td className={cn(td, "text-end")}>
                  <button type="button" onClick={() => onEdit(e)} className="rounded-lg px-2 py-1 text-theme-xs font-medium text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10">Modifier</button>
                </td>
              )}
            </tr>
          ));
        })}
      </tbody>
    </table>
  );
}

export default function DrugIndexPage() {
  const { db, user, run } = useDemo();
  const idx = indexOf(db);
  const [q, setQ] = useState("");
  const [species, setSpecies] = useState("");
  const [source, setSource] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [edit, setEdit] = useState<EntryDraft | null>(null);
  const [print, setPrint] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const editor = user?.roleId === "dg" || user?.roleId === "vet";
  const speciesList = Array.from(new Set(idx.entries.map((e) => e.species))).sort((a, b) => a.localeCompare(b, "fr"));
  const needle = normText(q);
  const list = idx.entries.filter((e) => (!species || e.species === species) && (!source || e.sourceId === source) && (!needle || normText(`${e.molecule} ${e.indication ?? ""} ${e.note ?? ""}`).includes(needle)));
  const groups = groupByMolecule(list);
  const letters = Array.from(new Set(groups.map((g) => letterOf(g[0].molecule))));
  const count = (id: string) => idx.entries.filter((e) => e.sourceId === id).length;
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb
        pageTitle="Index thérapeutique"
        subtitle="Posologies de référence de la clinique, par espèce et par molécule"
        trail={[{ label: "Pharmacie", href: "/stock" }]}
        actions={
          <>
            {idx.entries.length > 0 && <Button size="sm" variant="outline" startIcon={<PrinterIcon />} onClick={() => setPrint(true)}>Imprimer</Button>}
            {editor && <Button size="sm" variant="outline" startIcon={<PlusIcon />} onClick={() => setEdit({ species: species || "Cheval", molecule: "" })}>Ajouter une ligne</Button>}
            {editor && <Button size="sm" onClick={() => setImportOpen(true)}>Importer un tableau</Button>}
          </>
        }
      />

      {idx.entries.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center dark:border-gray-700 dark:bg-white/3">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Votre index est vide</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-gray-600 dark:text-gray-400">Importez votre tableau de posologies (Excel ou CSV) : une ligne de titres avec Molécule, Indication, Posologie, Voie et AMM suffit. Vous pouvez aussi ajouter les lignes une à une. Ces données restent dans votre clinique.</p>
          {editor && (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button onClick={() => setImportOpen(true)}>Importer un tableau</Button>
              <Button variant="outline" onClick={() => setEdit({ species: "Cheval", molecule: "" })}>Ajouter une ligne</Button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <input type="search" aria-label="Rechercher une molécule ou une indication" placeholder="Molécule ou indication (ex. flunixine, sédation)" value={q} onChange={(e) => setQ(e.target.value)} className={cn(sel, "min-w-0 flex-1 basis-64")} />
            <select aria-label="Espèce" className={sel} value={species} onChange={(e) => setSpecies(e.target.value)}>
              <option value="">Toutes les espèces</option>
              {speciesList.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {idx.sources.length > 1 && (
              <select aria-label="Tableau" className={sel} value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="">Tous les tableaux</option>
                {idx.sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
          </div>
          {letters.length > 3 && !needle && (
            <nav aria-label="Aller à la lettre" className="flex flex-wrap gap-1">
              {letters.map((l) => <a key={l} href={`#lettre-${l}`} className="grid size-8 place-items-center rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:border-brand-400 hover:text-brand-600 dark:border-gray-700 dark:text-gray-300">{l}</a>)}
            </nav>
          )}
          <p className="text-theme-sm text-gray-500"><strong className="tabular-nums text-gray-800 dark:text-white/90">{groups.length}</strong> molécule(s) · {list.length} ligne(s). Vérifiez la posologie et l&apos;AMM en vigueur avant toute prescription.</p>
          <div className="max-h-[70vh] overflow-auto rounded-2xl border border-gray-200 bg-white shadow-cliva dark:border-gray-800 dark:bg-white/3">
            {groups.length ? <IndexTable groups={groups} onEdit={editor ? (e) => setEdit({ ...e }) : undefined} /> : <p className="px-5 py-10 text-center text-sm text-gray-500">Aucune ligne ne correspond à cette recherche.</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/3">
              <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-white/90">Abréviations</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {ABBREVIATIONS.map((g) => (
                  <dl key={g.group} className="space-y-1 text-theme-sm">
                    <dt className="font-medium text-gray-500">{g.group}</dt>
                    {g.items.map(([k, v]) => <dd key={k} className="text-gray-700 dark:text-gray-300"><strong className="text-gray-800 dark:text-white/90">{k}</strong> {v}</dd>)}
                  </dl>
                ))}
              </div>
            </section>
            <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/3">
              <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-white/90">Tableaux importés</h3>
              <ul className="space-y-2">
                {idx.sources.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-gray-50 px-3 py-2 dark:bg-white/5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-white/90">{s.name} <span className="font-normal text-gray-500">· {s.species} · {count(s.id)} ligne(s)</span></p>
                      <p className="text-theme-xs text-gray-500">{[s.reference, s.fileName, `importé le ${formatDate(s.importedAt)} par ${userName(db, s.importedById)}`].filter(Boolean).join(" · ")}</p>
                    </div>
                    {user?.roleId === "dg" && (
                      <Button size="xs" variant="ghost" onClick={() => (removing === s.id ? (run(removeDrugIndexSource, { id: s.id }), setRemoving(null)) : setRemoving(s.id))}>{removing === s.id ? "Confirmer le retrait" : "Retirer"}</Button>
                    )}
                  </li>
                ))}
                {!idx.sources.length && <li className="text-theme-sm text-gray-500">Aucun : lignes saisies à la main.</li>}
              </ul>
            </section>
          </div>
        </>
      )}

      <DrugIndexImport open={importOpen} onClose={() => setImportOpen(false)} />
      <DrugIndexEntryModal value={edit} onClose={() => setEdit(null)} />
      <PrintFrame open={print} onClose={() => setPrint(false)} title="Index thérapeutique">
        <PrintHeader title="Index thérapeutique" sub={<p className="font-semibold">{species || "Toutes espèces"}{q ? ` · recherche « ${q} »` : ""}</p>} />
        <div className="mt-3"><IndexTable groups={groups} print /></div>
        <p className="mt-3 text-[10px] text-gray-600">{ABBREVIATIONS.map((g) => g.items.map(([k, v]) => `${k} = ${v}`).join(" · ")).join(" — ")}</p>
        {idx.sources.length > 0 && <p className="mt-1 text-[10px] text-gray-600">Sources : {idx.sources.map((s) => [s.name, s.reference].filter(Boolean).join(", ")).join(" ; ")}. Référence interne : vérifier posologie et AMM avant prescription.</p>}
      </PrintFrame>
    </div>
  );
}
