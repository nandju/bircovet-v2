import { uid } from "../format";
import type { DrugIndexEntry } from "../types";
import { audit, fail, must, produce, requireRole, type Service } from "./core";

const EDIT = ["dg", "vet"] as const;
type Row = Omit<DrugIndexEntry, "id" | "updatedAt" | "updatedById" | "sourceId">;

const clean = (r: Row): Row => ({
  species: r.species.trim(),
  molecule: r.molecule.trim(),
  indication: r.indication?.trim() || undefined,
  dosage: r.dosage?.trim() || undefined,
  route: r.route?.trim() || undefined,
  amm: r.amm?.trim() || undefined,
  note: r.note?.trim() || undefined,
});

export interface ImportInput {
  name: string;
  species: string;
  reference?: string;
  fileName?: string;
  rows: Row[];
  /** Remplacer les lignes d'un import précédent portant le même nom. */
  replace?: boolean;
}

/** Importer un tableau dans l'index thérapeutique de la clinique. */
export const importDrugIndex: Service<ImportInput, string> = (db, ctx, input) =>
  produce(db, (d) => {
    requireRole(ctx, [...EDIT], "index thérapeutique");
    if (!input.name.trim()) fail("Donnez un nom à ce tableau (par exemple « Index équin »).");
    const rows = input.rows.map(clean).filter((r) => r.molecule && r.species);
    if (!rows.length) fail("Aucune ligne utilisable : vérifiez que le tableau a une colonne « Molécule ».");
    d.drugIndex = d.drugIndex ?? { entries: [], sources: [] };
    const today = ctx.now.slice(0, 10);
    let replaced = 0;
    const prev = d.drugIndex.sources.find((s) => s.name.trim().toLowerCase() === input.name.trim().toLowerCase());
    if (prev && input.replace) {
      replaced = d.drugIndex.entries.filter((e) => e.sourceId === prev.id).length;
      d.drugIndex.entries = d.drugIndex.entries.filter((e) => e.sourceId !== prev.id);
      Object.assign(prev, { species: input.species, reference: input.reference?.trim() || prev.reference, fileName: input.fileName, importedAt: today, importedById: ctx.user.id });
    }
    const source = prev && input.replace ? prev : { id: uid("dis"), name: input.name.trim(), species: input.species, reference: input.reference?.trim() || undefined, fileName: input.fileName, importedAt: today, importedById: ctx.user.id };
    if (!(prev && input.replace)) d.drugIndex.sources.push(source);
    for (const r of rows) d.drugIndex.entries.push({ ...r, id: uid("die"), sourceId: source.id, updatedAt: today, updatedById: ctx.user.id });
    audit(d, ctx, { module: "stock", action: "create", target: `Index thérapeutique : ${rows.length} ligne(s) importée(s) (${source.name})` });
    return { message: `${rows.length} ligne(s) ajoutée(s) à l'index${replaced ? ` (${replaced} ancienne(s) remplacée(s))` : ""}.`, data: source.id };
  });

/** Ajouter ou modifier une ligne à la main. */
export const saveDrugIndexEntry: Service<Row & { id?: string }, string> = (db, ctx, input) =>
  produce(db, (d) => {
    requireRole(ctx, [...EDIT], "index thérapeutique");
    const r = clean(input);
    if (!r.molecule) fail("Indiquez la molécule.");
    if (!r.species) fail("Indiquez l'espèce.");
    if (!r.dosage && !r.indication) fail("Indiquez au moins l'indication ou la posologie.");
    d.drugIndex = d.drugIndex ?? { entries: [], sources: [] };
    const today = ctx.now.slice(0, 10);
    if (input.id) {
      const e = must(d.drugIndex.entries.find((x) => x.id === input.id), "Ligne introuvable.");
      Object.assign(e, r, { updatedAt: today, updatedById: ctx.user.id });
      return { message: `${e.molecule} : ligne modifiée.`, data: e.id };
    }
    const id = uid("die");
    d.drugIndex.entries.push({ ...r, id, updatedAt: today, updatedById: ctx.user.id });
    return { message: `${r.molecule} ajoutée à l'index.`, data: id };
  });

export const deleteDrugIndexEntry: Service<{ id: string }> = (db, ctx, { id }) =>
  produce(db, (d) => {
    requireRole(ctx, [...EDIT], "index thérapeutique");
    const list = d.drugIndex?.entries ?? [];
    const e = must(list.find((x) => x.id === id), "Ligne introuvable.");
    d.drugIndex!.entries = list.filter((x) => x.id !== id);
    return { message: `Ligne « ${e.molecule} » supprimée.` };
  });

/** Retirer tout un tableau importé (et ses lignes). */
export const removeDrugIndexSource: Service<{ id: string }> = (db, ctx, { id }) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg"], "suppression d'un tableau de l'index");
    const s = must(d.drugIndex?.sources.find((x) => x.id === id), "Tableau introuvable.");
    const n = d.drugIndex!.entries.filter((e) => e.sourceId === id).length;
    d.drugIndex!.entries = d.drugIndex!.entries.filter((e) => e.sourceId !== id);
    d.drugIndex!.sources = d.drugIndex!.sources.filter((x) => x.id !== id);
    audit(d, ctx, { module: "stock", action: "delete", target: `Index thérapeutique : « ${s.name} » retiré (${n} lignes)` });
    return { message: `« ${s.name} » retiré : ${n} ligne(s) supprimée(s).` };
  });
