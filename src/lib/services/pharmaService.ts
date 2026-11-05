/**
 * Index des molécules : validation vétérinaire, fiches créées par la clinique,
 * composition des produits et journal des calculs de dose.
 */
import { uid } from "../format";
import { pharmaOf } from "../pharma/state";
import type { CalcLogEntry, DemoDB, DraftMolecule, MoleculeStatus, PharmaState } from "../types";
import { audit, fail, must, produce, type Service } from "./core";

function ensure(d: DemoDB): PharmaState {
  if (!d.pharma) d.pharma = structuredClone(pharmaOf(d));
  return d.pharma;
}

const LABEL: Record<MoleculeStatus, string> = { brouillon: "brouillon", a_valider: "à valider", valide: "validée", retire: "retirée" };

export const setMoleculeStatus: Service<{ id: string; name: string; status: MoleculeStatus; note?: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    const ph = ensure(d);
    if ((input.status === "valide" || input.status === "retire") && !ph.referentIds.includes(ctx.user.id)) fail("Seul un vétérinaire référent peut valider ou retirer une fiche molécule.");
    const prev = ph.states[input.id];
    const st = prev ?? { status: "a_valider" as MoleculeStatus, version: 1, history: [] };
    st.status = input.status;
    if (input.status === "valide") {
      st.validatedById = ctx.user.id;
      st.validatedAt = ctx.now;
    }
    st.history.unshift({ date: ctx.now, userId: ctx.user.id, action: `Statut : ${LABEL[input.status]}`, note: input.note });
    ph.states[input.id] = st;
    audit(d, ctx, { module: "Pharmacie", action: `Molécule ${LABEL[input.status]}`, target: input.name, reason: input.note });
    return { message: `Fiche ${input.name} : ${LABEL[input.status]}.` };
  });

export const setReferent: Service<{ userId: string; on: boolean }> = (db, ctx, input) =>
  produce(db, (d) => {
    if (ctx.user.roleId !== "dg") fail("Seul le DG désigne les vétérinaires référents.");
    const ph = ensure(d);
    ph.referentIds = input.on ? Array.from(new Set([...ph.referentIds, input.userId])) : ph.referentIds.filter((x) => x !== input.userId);
    return { message: "Vétérinaires référents mis à jour." };
  });

export type DraftInput = Omit<DraftMolecule, "id" | "createdById" | "createdAt">;

function validateDraft(x: DraftInput) {
  if (!x.name.trim()) fail("Nom de la molécule (DCI) requis.");
  for (const p of x.posologies) {
    if (!p.species) fail("Chaque posologie doit indiquer une espèce.");
    if (!(p.max > 0) || p.min < 0 || p.min > p.max) fail(`Fourchette invalide pour ${p.species} : minimum ≤ maximum, valeurs positives.`);
    if (!p.unit) fail("Unité de dose requise.");
  }
}

/** Crée ou modifie une fiche locale. Toute modification la repasse « à valider » (nouvelle version). */
export const saveDraftMolecule: Service<DraftInput & { id?: string }, string> = (db, ctx, input) =>
  produce(db, (d) => {
    validateDraft(input);
    const ph = ensure(d);
    const clean = { ...input, name: input.name.trim(), posologies: input.posologies.map((p) => ({ ...p, id: p.id || uid("pos") })) };
    if (input.id) {
      const ex = must(ph.drafts.find((x) => x.id === input.id), "Fiche introuvable.");
      Object.assign(ex, clean, { id: ex.id });
      const st = ph.states[ex.id] ?? { status: "brouillon" as MoleculeStatus, version: 1, history: [] };
      st.version += 1;
      if (st.status === "valide") st.status = "a_valider";
      st.history.unshift({ date: ctx.now, userId: ctx.user.id, action: `Version ${st.version} enregistrée` });
      ph.states[ex.id] = st;
      return { message: "Fiche modifiée : elle repasse « à valider ».", data: ex.id };
    }
    const id = `loc-${uid("mol")}`;
    ph.drafts.push({ ...clean, id, createdById: ctx.user.id, createdAt: ctx.now });
    ph.states[id] = { status: "brouillon", version: 1, history: [{ date: ctx.now, userId: ctx.user.id, action: "Fiche créée (brouillon)" }] };
    audit(d, ctx, { module: "Pharmacie", action: "Nouvelle fiche molécule", target: clean.name });
    return { message: "Fiche créée en brouillon.", data: id };
  });

export const logCalculation: Service<Omit<CalcLogEntry, "id" | "date" | "userId">> = (db, ctx, input) =>
  produce(db, (d) => {
    const ph = ensure(d);
    ph.calcLog.unshift({ ...input, id: uid("calc"), date: ctx.now, userId: ctx.user.id });
    if (ph.calcLog.length > 300) ph.calcLog.length = 300;
    return { message: "Calcul enregistré dans le journal." };
  });
