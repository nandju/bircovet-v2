import { careSummary, CARE_REASON, defaultNextCheck } from "../care";
import { addDays, uid } from "../format";
import type { CareCase, CareFollowUp, CareTreatment, FarmAnimal, FarmIntervention } from "../types";
import { audit, fail, must, nextCode, produce, requireRole, type Service } from "./core";

const ROLES = ["dg", "vet", "assistant"] as const;

export const registerFarmAnimal: Service<{ farmId: string; animal: Omit<FarmAnimal, "id" | "status" | "addedAt"> }, string> = (db, ctx, { farmId, animal }) =>
  produce(db, (d) => {
    requireRole(ctx, [...ROLES], "identification d'animaux");
    const f = must(d.farms.find((x) => x.id === farmId), "Exploitation introuvable.");
    if (!animal.tag.trim()) fail("Numéro de boucle ou d'identification requis.");
    f.animals = f.animals ?? [];
    if (f.animals.some((a) => a.tag.trim().toLowerCase() === animal.tag.trim().toLowerCase() && a.status === "present")) fail(`Le n° ${animal.tag} existe déjà dans cet élevage.`);
    const id = uid("fan");
    f.animals.push({ ...animal, tag: animal.tag.trim(), name: animal.name?.trim() || undefined, id, status: "present", addedAt: ctx.now.slice(0, 10) });
    return { message: `Animal n° ${animal.tag.trim()} identifié.`, data: id };
  });

export interface CareInput {
  farmId: string;
  scope: CareCase["scope"];
  reason: CareCase["reason"];
  animalId?: string;
  /** Nouvel animal à identifier en même temps. */
  newAnimal?: Omit<FarmAnimal, "id" | "status" | "addedAt">;
  lotId?: string;
  species: string;
  count: number;
  date: string;
  vetId: string;
  missionId?: string;
  complaint: string;
  exam: CareCase["exam"];
  diagnosis: string;
  treatments: Omit<CareTreatment, "id">[];
  advice: string;
  nextCheckDays?: number;
  /** Consigner dans le rapport de visite du jour. */
  addToVisit: boolean;
  parentId?: string;
}

const KIND_OF: Record<CareCase["reason"], FarmIntervention["kind"]> = { appel: "traitement", visite_routine: "conseil", traitement_routine: "traitement", pathologie: "traitement" };

export const openCareCase: Service<CareInput, string> = (db, ctx, input) =>
  produce(db, (d) => {
    requireRole(ctx, [...ROLES], "prise en charge en élevage");
    const f = must(d.farms.find((x) => x.id === input.farmId), "Exploitation introuvable.");
    if (!input.species) fail("Espèce requise.");
    if (input.scope === "lot" && !input.lotId) fail("Choisissez la bande ou le lot.");
    if (!(input.count >= 1)) fail("Nombre d'animaux concernés : 1 minimum.");
    if (input.reason === "appel" && !input.complaint.trim()) fail("Décrivez le motif de l'appel (ce que présente l'animal).");
    let animalId = input.animalId;
    if (input.scope === "animal") {
      if (input.newAnimal) {
        if (!input.newAnimal.tag.trim()) fail("Numéro de boucle requis pour identifier l'animal.");
        f.animals = f.animals ?? [];
        if (f.animals.some((a) => a.tag.trim().toLowerCase() === input.newAnimal!.tag.trim().toLowerCase() && a.status === "present")) fail(`Le n° ${input.newAnimal.tag} existe déjà : choisissez-le dans la liste.`);
        animalId = uid("fan");
        f.animals.push({ ...input.newAnimal, tag: input.newAnimal.tag.trim(), id: animalId, status: "present", addedAt: input.date });
      }
      if (!animalId) fail("Choisissez l'animal ou identifiez-le.");
    }
    const treatments = input.treatments.filter((t) => t.product.trim()).map((t) => ({ ...t, product: t.product.trim(), id: uid("ctr") }));
    const id = uid("care");
    const code = nextCode(d, "care", "PEC");
    const days = input.nextCheckDays ?? CARE_REASON[input.reason].days;
    const c: CareCase = {
      id, code, farmId: f.id, scope: input.scope, reason: input.reason, animalId, lotId: input.lotId || undefined, species: input.species, count: input.scope === "animal" ? 1 : input.count,
      openedAt: input.date, vetId: input.vetId || ctx.user.id, missionId: input.missionId || undefined, complaint: input.complaint.trim(), exam: { ...input.exam, findings: input.exam.findings.trim() },
      diagnosis: input.diagnosis.trim(), treatments, advice: input.advice.trim(), status: "en_cours", parentId: input.parentId,
      nextCheck: days > 0 ? addDays(input.date, days) : defaultNextCheck(input.reason, input.date), followUps: [],
    };
    d.careCases = d.careCases ?? [];
    d.careCases.unshift(c);
    // Chaque traitement apparaît aussi dans l'historique des interventions de l'élevage.
    f.interventions = f.interventions ?? [];
    for (const t of treatments.length ? treatments : [{ product: "", count: c.count } as CareTreatment])
      f.interventions.unshift({ id: uid("fint"), date: input.date, kind: KIND_OF[input.reason], species: input.species, lotId: input.lotId || undefined, count: t.count || c.count, product: t.product || undefined, productId: t.productId, problem: input.diagnosis.trim() || input.complaint.trim() || undefined, note: `${code}${t.dose ? ` · ${t.dose}` : ""}${t.route ? ` · ${t.route}` : ""}`, byId: ctx.user.id, missionId: input.missionId || undefined });
    if (input.addToVisit) {
      const text = careSummary(d, c);
      const same = f.visits.find((v) => v.date === input.date && v.vetId === c.vetId);
      if (same) same.report = `${same.report ? `${same.report}\n\n` : ""}[${code}] ${text}`;
      else f.visits.unshift({ id: uid("vis"), date: input.date, vetId: c.vetId, purpose: CARE_REASON[input.reason].label, report: `[${code}] ${text}`, missionId: input.missionId || undefined });
    }
    if (input.parentId) {
      const p = d.careCases.find((x) => x.id === input.parentId);
      if (p) p.followUps.push({ id: uid("cfu"), date: input.date, byId: ctx.user.id, channel: "visite", state: "stable", note: `Prise en charge étendue : ${code} (${c.scope === "cheptel" ? "tout le cheptel" : "bande"}, ${c.count} animaux).` });
    }
    audit(d, ctx, { module: "Exploitations", action: "Prise en charge", target: `${code} — ${f.code}` });
    return { message: `${code} ouverte. Prochaine prise de nouvelles le ${c.nextCheck?.split("-").reverse().join("/")}.`, data: id };
  });

export const logCareFollowUp: Service<{ caseId: string; channel: CareFollowUp["channel"]; state: CareFollowUp["state"]; sick?: number; dead?: number; note: string; nextCheckDays?: number }> = (db, ctx, input) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg", "vet", "assistant", "accueil"], "suivi des prises en charge");
    const c = must((d.careCases ?? []).find((x) => x.id === input.caseId), "Prise en charge introuvable.");
    if (c.status !== "en_cours") fail("Cette prise en charge est clôturée.");
    if (!input.note.trim()) fail("Notez ce que l'éleveur a dit.");
    if ((input.dead ?? 0) < 0 || (input.sick ?? 0) < 0) fail("Nombres invalides.");
    const today = ctx.now.slice(0, 10);
    c.followUps.push({ id: uid("cfu"), date: today, byId: ctx.user.id, channel: input.channel, state: input.state, sick: input.sick, dead: input.dead, note: input.note.trim() });
    if (input.state === "gueri" || (input.state === "deces" && c.scope === "animal")) {
      c.status = input.state === "gueri" ? "gueri" : "deces";
      c.closedAt = today;
      c.nextCheck = undefined;
      c.outcome = input.note.trim();
    } else c.nextCheck = addDays(today, Math.max(1, input.nextCheckDays ?? (input.state === "aggravation" ? 1 : 3)));
    if (c.scope === "animal" && input.state === "deces") {
      const f = d.farms.find((x) => x.id === c.farmId);
      const a = f?.animals?.find((x) => x.id === c.animalId);
      if (a) a.status = "mort";
    }
    return { message: c.status === "en_cours" ? `Nouvelles notées. Prochain point le ${c.nextCheck?.split("-").reverse().join("/")}.` : "Nouvelles notées : prise en charge clôturée." };
  });

export const closeCareCase: Service<{ caseId: string; status: Exclude<CareCase["status"], "en_cours">; outcome: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    requireRole(ctx, [...ROLES], "clôture de prise en charge");
    const c = must((d.careCases ?? []).find((x) => x.id === input.caseId));
    if (c.status !== "en_cours") fail("Déjà clôturée.");
    c.status = input.status;
    c.closedAt = ctx.now.slice(0, 10);
    c.outcome = input.outcome.trim() || undefined;
    c.nextCheck = undefined;
    return { message: "Prise en charge clôturée." };
  });
