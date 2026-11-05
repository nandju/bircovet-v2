"use client";

import AppModal from "@/components/common/AppModal";
import { CheckField, FormGrid, SelectField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { INDEX_SPECIES, indexOf, normText, parseCsv, rowsToEntries, type ParsedIndex } from "@/lib/drugIndex";
import { importDrugIndex } from "@/lib/services/drugIndexService";
import { readXlsx, type SheetData } from "@/lib/xlsx";
import { useState } from "react";

const firstText = (rows: string[][], i: number) => rows[i]?.find((c) => c?.trim())?.trim() ?? "";

/** Importer un tableau Excel ou CSV dans l'index thérapeutique de la clinique. */
export default function DrugIndexImport({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db, run } = useDemo();
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [sheet, setSheet] = useState(0);
  const [fileName, setFileName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [v, setV] = useState({ name: "", species: "Cheval", reference: "", replace: true });
  if (!open) return null;
  const rows = sheets[sheet]?.rows ?? [];
  const parsed: ParsedIndex | null = rows.length ? rowsToEntries(rows, v.species) : null;
  const exists = indexOf(db).sources.some((s) => normText(s.name) === normText(v.name));
  const reset = () => {
    setSheets([]);
    setSheet(0);
    setFileName("");
    setErr("");
    setV({ name: "", species: "Cheval", reference: "", replace: true });
  };
  const close = () => {
    reset();
    onClose();
  };
  const guess = (data: SheetData[], name: string) => {
    const idx = Math.max(0, data.findIndex((s) => rowsToEntries(s.rows, "x")));
    const r = data[idx]?.rows ?? [];
    const p = rowsToEntries(r, "x");
    const title = p && p.headerRow > 0 ? firstText(r, 0) : "";
    const srcLine = r.slice(0, p?.headerRow ?? 0).map((x) => x.join(" ")).find((t) => /source\s*:/i.test(t));
    const reference = srcLine ? srcLine.replace(/^.*source\s*:\s*/i, "").split("•")[0].trim() : "";
    const hay = normText(`${name} ${title}`);
    const species = /equin|equide|cheval/.test(hay) ? "Cheval" : /bovin/.test(hay) ? "Bovin" : /canin|chien/.test(hay) ? "Chien" : /felin|chat/.test(hay) ? "Chat" : "Cheval";
    setSheet(idx);
    setV({ name: (title || name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ")).slice(0, 80), species, reference, replace: true });
  };
  const onFile = async (f?: File) => {
    if (!f) return;
    setErr("");
    setBusy(true);
    try {
      const data = /\.xlsx$/i.test(f.name) ? await readXlsx(await f.arrayBuffer()) : [{ name: f.name, rows: parseCsv(await f.text()) }];
      if (!data.some((s) => rowsToEntries(s.rows, "x"))) throw new Error("Aucune colonne « Molécule » trouvée. La première ligne du tableau doit contenir les titres : Molécule, Indication, Posologie, Voie, AMM.");
      setSheets(data);
      setFileName(f.name);
      guess(data, f.name);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Fichier illisible.");
      setSheets([]);
    } finally {
      setBusy(false);
    }
  };
  const save = () => {
    if (!parsed) return;
    const r = run(importDrugIndex, { name: v.name, species: v.species, reference: v.reference, fileName, rows: parsed.entries, replace: v.replace });
    if (r.ok) close();
  };
  const found = parsed ? Object.keys(parsed.columns) : [];
  return (
    <AppModal
      isOpen
      onClose={close}
      size="xl"
      title="Importer un tableau dans l'index"
      description="Un fichier Excel (.xlsx) ou CSV avec une ligne de titres : Molécule, Indication, Posologie, Voie, AMM. Les données restent dans votre clinique."
      footer={
        <>
          <Button variant="outline" onClick={close}>Annuler</Button>
          <Button onClick={save} disabled={!parsed?.entries.length}>{parsed ? `Importer ${parsed.entries.length} ligne(s)` : "Importer"}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 px-4 py-6 text-center hover:border-brand-400 dark:border-gray-700">
          <span className="text-sm font-semibold text-gray-800 dark:text-white/90">{fileName || "Choisir le fichier"}</span>
          <span className="text-theme-xs text-gray-500">{busy ? "Lecture du fichier…" : "Excel (.xlsx) ou CSV"}</span>
          <input type="file" accept=".xlsx,.csv,.txt" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        {err && <p className="rounded-xl bg-error-50 px-3 py-2 text-theme-sm text-error-700 dark:bg-error-500/10 dark:text-error-300">{err}</p>}
        {sheets.length > 1 && <SelectField label="Feuille du classeur" value={String(sheet)} onChange={(x) => setSheet(Number(x))} options={sheets.map((s, i) => ({ value: String(i), label: s.name }))} />}
        {parsed && (
          <>
            <FormGrid cols={2}>
              <TextField label="Nom de ce tableau" required value={v.name} onChange={(x) => setV({ ...v, name: x })} hint="Ex. « Index équin ». Réimporter sous le même nom remplace les anciennes lignes." />
              <SelectField label="Espèce" value={v.species} onChange={(x) => setV({ ...v, species: x })} options={INDEX_SPECIES.map((s) => ({ value: s, label: s }))} hint={found.includes("species") ? "Une colonne Espèce existe : elle prime pour chaque ligne." : undefined} />
            </FormGrid>
            <TextField label="Source (ouvrage, auteur, édition)" value={v.reference} onChange={(x) => setV({ ...v, reference: x })} placeholder="Titre, auteur, édition" />
            {exists && <CheckField label="Remplacer les lignes déjà importées sous ce nom" checked={v.replace} onChange={(x) => setV({ ...v, replace: !!x })} />}
            <div className="rounded-2xl bg-gray-50 px-4 py-3 text-theme-sm text-gray-700 dark:bg-white/5 dark:text-gray-300">
              <strong className="tabular-nums">{parsed.entries.length}</strong> ligne(s) prêtes · colonnes reconnues : {found.map((f) => ({ molecule: "Molécule", indication: "Indication", dosage: "Posologie", route: "Voie", amm: "AMM", note: "Note", species: "Espèce" })[f]).join(", ")}
              {parsed.skipped > 0 && <> · {parsed.skipped} ligne(s) ignorée(s) (vides ou sans posologie)</>}
            </div>
            <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800">
              <table className="w-full min-w-150 text-theme-sm">
                <thead className="bg-gray-50 text-start text-theme-xs text-gray-500 dark:bg-white/5">
                  <tr>{["Molécule", "Indication", "Posologie", "Voie", "AMM"].map((h) => <th key={h} className="px-3 py-2 text-start font-medium">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {parsed.entries.slice(0, 8).map((e, i) => (
                    <tr key={i} className="align-top text-gray-700 dark:text-gray-300">
                      <td className="px-3 py-2 font-medium text-gray-800 dark:text-white/90">{e.molecule}</td>
                      <td className="px-3 py-2">{e.indication}</td>
                      <td className="px-3 py-2">{e.dosage}</td>
                      <td className="px-3 py-2">{e.route}</td>
                      <td className="px-3 py-2">{e.amm}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsed.entries.length > 8 && <p className="text-theme-xs text-gray-500">Aperçu des 8 premières lignes sur {parsed.entries.length}.</p>}
          </>
        )}
      </div>
    </AppModal>
  );
}
