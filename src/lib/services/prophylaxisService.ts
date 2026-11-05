import { addDays, uid } from "../format";
import { PROPHY_KIND, scheduleSteps, startsAtOne } from "../prophylaxis";
import type { DemoDB, ProphylaxisPlan, ProphylaxisProgram, ProphyPlanStep, ProphyStepTemplate, ProphyTarget } from "../types";
import { audit, fail, must, nextCode, produce, requireRole, type Service } from "./core";

const EDIT = ["dg", "vet"] as const;
const APPLY = ["dg", "vet", "assistant"] as const;

const cleanSteps = (steps: ProphyStepTemplate[]): ProphyStepTemplate[] =>
  steps
    .filter((s) => s.label.trim())
    .map((s) => ({ ...s, id: s.id || uid("pst"), day: Math.round(s.day), label: s.label.trim(), product: s.product?.trim() || undefined, dose: s.dose?.trim() || undefined, route: s.route?.trim() || undefined, note: s.note?.trim() || undefined }))
    .sort((a, b) => a.day - b.day);

const autoClose = (p: ProphylaxisPlan, today: string) => {
  if (p.status === "en_cours" && p.steps.every((s) => s.status !== "a_faire")) {
    p.status = "termine";
    p.closedAt = today;
  }
};

export type ProgramInput = Pick<ProphylaxisProgram, "name" | "species" | "category" | "startLabel" | "description" | "steps"> & { id?: string };

/** Créer ou modifier un modèle de programme. */
export const saveProphylaxisProgram: Service<ProgramInput, string> = (db, ctx, input) =>
  produce(db, (d) => {
    requireRole(ctx, [...EDIT], "modèles de prophylaxie");
    if (!input.name.trim()) fail("Donnez un nom au programme.");
    if (!input.species) fail("Choisissez l'espèce.");
    const steps = cleanSteps(input.steps);
    if (!steps.length) fail("Ajoutez au moins une action (jour + action).");
    if (steps.some((s) => !Number.isFinite(s.day) || s.day < 0)) fail("Chaque action doit avoir un jour positif (0, 1, 7…).");
    d.prophylaxisPrograms = d.prophylaxisPrograms ?? [];
    const base = { name: input.name.trim(), species: input.species, category: input.category?.trim() || undefined, startLabel: input.startLabel.trim() || "Début du programme (J0)", description: input.description?.trim() || undefined, steps };
    if (input.id) {
      const p = must(d.prophylaxisPrograms.find((x) => x.id === input.id), "Programme introuvable.");
      Object.assign(p, base, { updatedAt: ctx.now.slice(0, 10) });
      audit(d, ctx, { module: "exploitations", action: "update", target: `Modèle de prophylaxie modifié : ${p.name}` });
      return { message: `Modèle « ${p.name} » enregistré. Les programmes déjà appliqués ne changent pas.`, data: p.id };
    }
    const id = uid("pgm");
    d.prophylaxisPrograms.push({ id, code: nextCode(d, "prophyProgram", "PRO"), ...base, active: true, createdAt: ctx.now.slice(0, 10) });
    audit(d, ctx, { module: "exploitations", action: "create", target: `Modèle de prophylaxie créé : ${base.name}` });
    return { message: `Modèle « ${base.name} » créé.`, data: id };
  });

export const setProgramActive: Service<{ id: string; active: boolean }> = (db, ctx, { id, active }) =>
  produce(db, (d) => {
    requireRole(ctx, [...EDIT], "modèles de prophylaxie");
    const p = must((d.prophylaxisPrograms ?? []).find((x) => x.id === id), "Programme introuvable.");
    p.active = active;
    return { message: active ? `Modèle « ${p.name} » réactivé.` : `Modèle « ${p.name} » archivé.` };
  });

export interface AssignInput {
  programId: string;
  target: ProphyTarget;
  farmId?: string;
  lotId?: string;
  animalId?: string;
  patientId?: string;
  count?: number;
  startDate: string;
  /** Dates modifiées avant validation (id d'action → date). */
  dates?: Record<string, string>;
  vetId?: string;
  note?: string;
  /** Les actions dont la date est déjà passée ont été faites (saisie d'un programme commencé avant Cliva). */
  pastDone?: boolean;
}

/** Appliquer un modèle : copie les actions avec leurs dates prévues (le modèle reste inchangé). */
export const assignProphylaxis: Service<AssignInput, string> = (db, ctx, input) =>
  produce(db, (d) => {
    requireRole(ctx, [...APPLY], "application d'un programme de prophylaxie");
    const pg = must((d.prophylaxisPrograms ?? []).find((x) => x.id === input.programId), "Choisissez un programme.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) fail("Indiquez la date de début.");
    let species = pg.species;
    if (input.target === "patient") {
      const pt = must(d.patients.find((x) => x.id === input.patientId), "Choisissez l'animal.");
      species = pt.species;
    } else {
      const f = must(d.farms.find((x) => x.id === input.farmId), "Choisissez l'exploitation.");
      if (input.target === "lot") must(f.lots.find((l) => l.id === input.lotId), "Choisissez la bande ou le lot.");
      if (input.target === "animal") {
        const a = must(f.animals?.find((x) => x.id === input.animalId), "Choisissez l'animal identifié.");
        species = a.species;
      }
    }
    const offset = startsAtOne(pg.steps) ? 1 : 0;
    const today = ctx.now.slice(0, 10);
    const steps: ProphyPlanStep[] = scheduleSteps(pg.steps, input.startDate, offset).map((s) => {
      const dueDate = input.dates?.[s.id] || s.dueDate;
      const past = !!input.pastDone && dueDate < today;
      return { ...s, id: uid("pps"), dueDate, status: past ? "fait" : "a_faire", ...(past ? { doneDate: dueDate, doneById: ctx.user.id, doneNote: "Fait avant la saisie dans Cliva" } : {}) };
    });
    const id = uid("ppl");
    const code = nextCode(d, "prophyPlan", "PPX");
    const plan: ProphylaxisPlan = {
      id, code, programId: pg.id, name: pg.name, species, target: input.target, farmId: input.target === "patient" ? undefined : input.farmId, lotId: input.target === "lot" ? input.lotId : undefined,
      animalId: input.target === "animal" ? input.animalId : undefined, patientId: input.target === "patient" ? input.patientId : undefined,
      count: input.target === "lot" || input.target === "cheptel" ? input.count || undefined : 1, startDate: input.startDate, startLabel: pg.startLabel, steps,
      status: "en_cours", vetId: input.vetId || ctx.user.id, note: input.note?.trim() || undefined, createdAt: ctx.now.slice(0, 10), createdById: ctx.user.id,
    };
    d.prophylaxisPlans = d.prophylaxisPlans ?? [];
    d.prophylaxisPlans.unshift(plan);
    audit(d, ctx, { module: "exploitations", action: "create", target: `Prophylaxie ${code} appliquée : ${pg.name}` });
    const done = steps.filter((s) => s.status === "fait").length;
    autoClose(plan, today);
    return { message: `Programme ${code} appliqué : ${steps.length - done} action(s) planifiée(s)${done ? `, ${done} déjà faite(s)` : ""}.`, data: id };
  });

const plan = (d: DemoDB, id: string) => must((d.prophylaxisPlans ?? []).find((x) => x.id === id), "Programme introuvable.");
const step = (p: ProphylaxisPlan, id: string) => must(p.steps.find((x) => x.id === id), "Action introuvable.");

/** Noter une action comme faite : elle rejoint l'historique de l'élevage ou le carnet du patient. */
export const markProphyStepDone: Service<{ planId: string; stepId: string; date: string; note?: string; lotRef?: string; product?: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    requireRole(ctx, [...APPLY], "suivi de la prophylaxie");
    const p = plan(d, input.planId);
    const s = step(p, input.stepId);
    if (s.status === "fait") fail("Cette action est déjà notée comme faite.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) fail("Indiquez la date de réalisation.");
    if (input.date > ctx.now.slice(0, 10)) fail("La date de réalisation ne peut pas être dans le futur.");
    s.status = "fait";
    s.doneDate = input.date;
    s.doneById = ctx.user.id;
    s.doneNote = input.note?.trim() || undefined;
    s.lotRef = input.lotRef?.trim() || undefined;
    if (input.product?.trim()) s.product = input.product.trim();
    const label = `${s.label}${s.product ? ` (${s.product})` : ""}`;
    if (p.target === "patient") {
      const pt = must(d.patients.find((x) => x.id === p.patientId), "Animal introuvable.");
      if (s.kind === "vaccination") {
        const next = p.steps.filter((x) => x.status === "a_faire" && x.kind === "vaccination").sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
        s.logId = uid("vac");
        pt.vaccinations.unshift({ id: s.logId, name: label, date: input.date, nextDue: next?.dueDate, authorId: ctx.user.id, lotRef: s.lotRef });
      }
    } else {
      const f = must(d.farms.find((x) => x.id === p.farmId), "Exploitation introuvable.");
      f.interventions = f.interventions ?? [];
      s.logId = uid("fint");
      f.interventions.unshift({ id: s.logId, date: input.date, kind: PROPHY_KIND[s.kind].farmKind, species: p.species, lotId: p.lotId, count: p.count ?? 1, product: s.product, productId: s.productId, note: `${p.code} · ${s.label}${s.dose ? ` · ${s.dose}` : ""}${s.route ? ` · ${s.route}` : ""}${s.doneNote ? ` · ${s.doneNote}` : ""}`, byId: ctx.user.id });
    }
    autoClose(p, ctx.now.slice(0, 10));
    audit(d, ctx, { module: "exploitations", action: "update", target: `${p.code} : ${s.label} fait le ${input.date}` });
    return { message: `« ${s.label} » noté comme fait.${p.status === "termine" ? " Programme terminé." : ""}` };
  });

/** Annuler la réalisation (erreur de saisie) : l'action revient « à faire » et sa trace est retirée. */
export const undoProphyStep: Service<{ planId: string; stepId: string }> = (db, ctx, { planId, stepId }) =>
  produce(db, (d) => {
    requireRole(ctx, [...EDIT], "correction de la prophylaxie");
    const p = plan(d, planId);
    const s = step(p, stepId);
    if (s.logId) {
      const pt = d.patients.find((x) => x.id === p.patientId);
      if (pt) pt.vaccinations = pt.vaccinations.filter((v) => v.id !== s.logId);
      const f = d.farms.find((x) => x.id === p.farmId);
      if (f?.interventions) f.interventions = f.interventions.filter((i) => i.id !== s.logId);
    }
    Object.assign(s, { status: "a_faire", doneDate: undefined, doneById: undefined, doneNote: undefined, lotRef: undefined, logId: undefined });
    if (p.status === "termine") {
      p.status = "en_cours";
      p.closedAt = undefined;
    }
    return { message: `« ${s.label} » remis à faire.` };
  });

export interface StepPatch {
  planId: string;
  stepId: string;
  dueDate?: string;
  label?: string;
  kind?: ProphyPlanStep["kind"];
  product?: string;
  dose?: string;
  route?: string;
  note?: string;
  /** Décaler aussi les actions suivantes encore à faire du même nombre de jours. */
  shiftFollowing?: boolean;
}

/** Modifier une action d'un programme appliqué (date, produit…), ou la reporter avec les suivantes. */
export const editProphyStep: Service<StepPatch> = (db, ctx, input) =>
  produce(db, (d) => {
    requireRole(ctx, [...APPLY], "modification de la prophylaxie");
    const p = plan(d, input.planId);
    const s = step(p, input.stepId);
    if (input.label !== undefined && !input.label.trim()) fail("L'action doit avoir un libellé.");
    let shifted = 0;
    if (input.dueDate && input.dueDate !== s.dueDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) fail("Date invalide.");
      const delta = Math.round((Date.parse(input.dueDate) - Date.parse(s.dueDate)) / 864e5);
      if (input.shiftFollowing && s.status === "a_faire")
        for (const o of p.steps)
          if (o.id !== s.id && o.status === "a_faire" && o.dueDate >= s.dueDate) {
            o.dueDate = addDays(o.dueDate, delta);
            shifted++;
          }
      s.dueDate = input.dueDate;
    }
    if (input.label !== undefined) s.label = input.label.trim();
    if (input.kind) s.kind = input.kind;
    for (const k of ["product", "dose", "route", "note"] as const) if (input[k] !== undefined) s[k] = input[k]!.trim() || undefined;
    p.steps.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    return { message: `Action modifiée${shifted ? ` ; ${shifted} action(s) suivante(s) décalée(s)` : ""}.` };
  });

export const addProphyStep: Service<{ planId: string; step: Omit<ProphyStepTemplate, "id" | "day"> & { dueDate: string } }> = (db, ctx, input) =>
  produce(db, (d) => {
    requireRole(ctx, [...APPLY], "modification de la prophylaxie");
    const p = plan(d, input.planId);
    if (!input.step.label.trim()) fail("Décrivez l'action.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.step.dueDate)) fail("Indiquez la date prévue.");
    const day = Math.round((Date.parse(input.step.dueDate) - Date.parse(p.startDate)) / 864e5) + (startsAtOne(p.steps) ? 1 : 0);
    p.steps.push({ ...input.step, label: input.step.label.trim(), id: uid("pps"), day, status: "a_faire" });
    p.steps.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    if (p.status === "termine") p.status = "en_cours";
    return { message: "Action ajoutée au programme." };
  });

export const cancelProphyStep: Service<{ planId: string; stepId: string; restore?: boolean }> = (db, ctx, { planId, stepId, restore }) =>
  produce(db, (d) => {
    requireRole(ctx, [...APPLY], "modification de la prophylaxie");
    const p = plan(d, planId);
    const s = step(p, stepId);
    if (s.status === "fait") fail("Action déjà faite : utilisez « Annuler la saisie ».");
    s.status = restore ? "a_faire" : "annule";
    if (!restore) autoClose(p, ctx.now.slice(0, 10));
    else if (p.status === "termine") p.status = "en_cours";
    return { message: restore ? "Action rétablie." : `« ${s.label} » retirée du programme.` };
  });

export const closeProphyPlan: Service<{ planId: string; note?: string; reopen?: boolean }> = (db, ctx, { planId, note, reopen }) =>
  produce(db, (d) => {
    requireRole(ctx, [...EDIT], "arrêt d'un programme de prophylaxie");
    const p = plan(d, planId);
    if (reopen) {
      p.status = "en_cours";
      p.closedAt = undefined;
      return { message: `${p.code} repris.` };
    }
    p.status = "arrete";
    p.closedAt = ctx.now.slice(0, 10);
    if (note?.trim()) p.note = [p.note, `Arrêt : ${note.trim()}`].filter(Boolean).join("\n");
    audit(d, ctx, { module: "exploitations", action: "update", target: `${p.code} arrêté` });
    return { message: `${p.code} arrêté. Les actions faites restent dans l'historique.` };
  });

/** Enregistrer un programme appliqué (et ses modifications) comme nouveau modèle réutilisable. */
export const planToProgram: Service<{ planId: string; name: string }, string> = (db, ctx, { planId, name }) => {
  const p = (db.prophylaxisPlans ?? []).find((x) => x.id === planId);
  if (!p) return { ok: false, error: "Programme introuvable." };
  const offset = startsAtOne(p.steps) ? 1 : 0;
  const steps = p.steps.filter((s) => s.status !== "annule").map((s) => ({ id: uid("pst"), day: Math.round((Date.parse(s.dueDate) - Date.parse(p.startDate)) / 864e5) + offset, kind: s.kind, label: s.label, product: s.product, dose: s.dose, route: s.route, note: s.note }));
  return saveProphylaxisProgram(db, ctx, { name, species: p.species, category: undefined, startLabel: p.startLabel, description: `Créé à partir de ${p.code}.`, steps });
};
