/**
 * Prophylaxie : modèles de programmes (vaccins, déparasitages, vitamines…) appliqués à un cheptel,
 * une bande, un animal identifié ou un animal de compagnie, avec les dates prévues de chaque action.
 */
import { addDays } from "./format";
import type { DemoDB, ProphyKind, ProphylaxisPlan, ProphylaxisProgram, ProphyPlanStep, ProphyStepTemplate } from "./types";

export const PROPHY_KIND: Record<ProphyKind, { label: string; tone: string; farmKind: "vaccination" | "deparasitage" | "traitement" | "conseil" | "autre" }> = {
  vaccination: { label: "Vaccination", tone: "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300", farmKind: "vaccination" },
  deparasitage: { label: "Déparasitage", tone: "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300", farmKind: "deparasitage" },
  vitamines: { label: "Vitamines", tone: "bg-yellow-50 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300", farmKind: "traitement" },
  anticoccidien: { label: "Anticoccidien", tone: "bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300", farmKind: "traitement" },
  antibiotique: { label: "Antibiotique", tone: "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-300", farmKind: "traitement" },
  desinfection: { label: "Hygiène / désinfection", tone: "bg-blue-light-50 text-blue-light-700 dark:bg-blue-light-500/15 dark:text-blue-light-300", farmKind: "conseil" },
  pesee: { label: "Pesée / contrôle", tone: "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300", farmKind: "autre" },
  autre: { label: "Autre", tone: "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300", farmKind: "autre" },
};
export const PROPHY_KINDS = Object.entries(PROPHY_KIND).map(([value, v]) => ({ value, label: v.label }));

/** Espèces proposées pour un programme (élevage et compagnie). */
export const PROPHY_SPECIES = ["Volaille", "Bovin", "Ovin", "Caprin", "Porcin", "Lapin", "Poisson", "Équidé", "Chien", "Chat", "Autre"];
export const COMPANION = ["Chien", "Chat"];

export const PLAN_STATUS: Record<ProphylaxisPlan["status"], { label: string; tone: string }> = {
  en_cours: { label: "En cours", tone: "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300" },
  termine: { label: "Terminé", tone: "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300" },
  arrete: { label: "Arrêté", tone: "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-300" },
};

export type StepState = "fait" | "annule" | "en_retard" | "aujourdhui" | "bientot" | "a_venir";
export const STEP_STATE: Record<StepState, { label: string; tone: string }> = {
  fait: { label: "Fait", tone: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-300" },
  annule: { label: "Annulé", tone: "bg-gray-100 text-gray-500 line-through dark:bg-white/10" },
  en_retard: { label: "En retard", tone: "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-300" },
  aujourdhui: { label: "Aujourd'hui", tone: "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300" },
  bientot: { label: "Cette semaine", tone: "bg-yellow-50 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300" },
  a_venir: { label: "À venir", tone: "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300" },
};

export function stepState(s: ProphyPlanStep, today: string): StepState {
  if (s.status === "fait") return "fait";
  if (s.status === "annule") return "annule";
  if (s.dueDate < today) return "en_retard";
  if (s.dueDate === today) return "aujourdhui";
  if (s.dueDate <= addDays(today, 7)) return "bientot";
  return "a_venir";
}

/** Dates prévues des actions d'un modèle à partir de la date de début (jour 0 = date de début). */
export function scheduleSteps(steps: ProphyStepTemplate[], startDate: string, offset = 0): (ProphyStepTemplate & { dueDate: string })[] {
  return [...steps].sort((a, b) => a.day - b.day).map((s) => ({ ...s, dueDate: addDays(startDate, s.day - offset) }));
}

/** Le programme compte-t-il à partir de J1 (volailles) ou J0 ? */
export const startsAtOne = (steps: ProphyStepTemplate[]) => steps.length > 0 && Math.min(...steps.map((s) => s.day)) >= 1;

export function planTarget(db: DemoDB, p: ProphylaxisPlan): string {
  if (p.target === "patient") {
    const pt = db.patients.find((x) => x.id === p.patientId);
    const owner = pt ? db.clients.find((c) => c.id === pt.ownerId) : undefined;
    return pt ? `${pt.name} (${pt.species.toLowerCase()})${owner ? ` · ${owner.name}` : ""}` : "Animal";
  }
  const f = db.farms.find((x) => x.id === p.farmId);
  const farm = f?.name ?? "Exploitation";
  if (p.target === "animal") {
    const a = f?.animals?.find((x) => x.id === p.animalId);
    return `${farm} · ${p.species} n° ${a?.tag ?? "?"}${a?.name ? ` (${a.name})` : ""}`;
  }
  if (p.target === "lot") return `${farm} · ${f?.lots.find((l) => l.id === p.lotId)?.name ?? "Bande"}${p.count ? ` · ${p.count} sujets` : ""}`;
  return `${farm} · tout le cheptel ${p.species.toLowerCase()}${p.count ? ` · ${p.count} animaux` : ""}`;
}

export const planProgress = (p: ProphylaxisPlan) => {
  const live = p.steps.filter((s) => s.status !== "annule");
  const done = live.filter((s) => s.status === "fait").length;
  return { done, total: live.length, pct: live.length ? Math.round((done / live.length) * 100) : 0, next: live.filter((s) => s.status === "a_faire").sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] };
};

export interface DueAction {
  plan: ProphylaxisPlan;
  step: ProphyPlanStep;
  state: StepState;
}

/** Actions à faire des programmes en cours, jusqu'à `horizon` jours. */
export function dueActions(db: DemoDB, today: string, horizon = 30): DueAction[] {
  const end = addDays(today, horizon);
  const out: DueAction[] = [];
  for (const plan of db.prophylaxisPlans ?? []) {
    if (plan.status !== "en_cours") continue;
    for (const step of plan.steps) if (step.status === "a_faire" && step.dueDate <= end) out.push({ plan, step, state: stepState(step, today) });
  }
  return out.sort((a, b) => a.step.dueDate.localeCompare(b.step.dueDate));
}

export const overdueCount = (db: DemoDB, today: string) => dueActions(db, today, 0).length;

/* ---------- Modèles de départ (à adapter par le vétérinaire) ---------- */

const st = (id: string, day: number, kind: ProphyKind, label: string, extra: Partial<ProphyStepTemplate> = {}): ProphyStepTemplate => ({ id, day, kind, label, ...extra });
const NOTE = "Modèle de départ à adapter par le vétérinaire : produits, voies et dates selon le contexte sanitaire et la réglementation.";

export function defaultPrograms(createdAt: string): ProphylaxisProgram[] {
  const p = (id: string, code: string, name: string, species: string, category: string, startLabel: string, steps: ProphyStepTemplate[]): ProphylaxisProgram => ({ id, code, name, species, category, startLabel, description: NOTE, steps, active: true, createdAt });
  return [
    p("pgm-chair", "PRO-0001", "Poulets de chair (45 jours)", "Volaille", "Poulets de chair", "Arrivée des poussins (J1)", [
      st("c1", 1, "vitamines", "Anti-stress à l'arrivée", { product: "Vitamines + sucre dans l'eau", note: "J1 à J3" }),
      st("c2", 1, "autre", "Vérifier les vaccins faits au couvoir", { note: "Demander le certificat de vaccination du couvoir" }),
      st("c3", 5, "vaccination", "Newcastle + bronchite infectieuse", { route: "Eau de boisson ou goutte oculaire" }),
      st("c4", 10, "vaccination", "Gumboro (1re prise)", { route: "Eau de boisson" }),
      st("c5", 14, "anticoccidien", "Anticoccidien préventif", { note: "3 jours" }),
      st("c6", 18, "vaccination", "Gumboro (rappel)", { route: "Eau de boisson" }),
      st("c7", 21, "vaccination", "Newcastle (rappel)", { route: "Eau de boisson" }),
      st("c8", 28, "vitamines", "Vitamines", { note: "2 à 3 jours" }),
      st("c9", 35, "pesee", "Pesée d'un échantillon de 20 sujets"),
      st("c10", 45, "desinfection", "Fin de bande : nettoyage, désinfection, vide sanitaire"),
    ]),
    p("pgm-ponte", "PRO-0002", "Poulettes futures pondeuses (0 à 18 semaines)", "Volaille", "Pondeuses", "Arrivée des poussins (J1)", [
      st("p1", 1, "vitamines", "Anti-stress à l'arrivée", { note: "J1 à J3" }),
      st("p2", 1, "autre", "Vérifier Marek fait au couvoir"),
      st("p3", 5, "vaccination", "Newcastle + bronchite infectieuse", { route: "Eau de boisson ou goutte oculaire" }),
      st("p4", 10, "vaccination", "Gumboro (1re prise)", { route: "Eau de boisson" }),
      st("p5", 18, "vaccination", "Gumboro (rappel)", { route: "Eau de boisson" }),
      st("p6", 21, "vaccination", "Newcastle (rappel)", { route: "Eau de boisson" }),
      st("p7", 42, "vaccination", "Variole aviaire", { route: "Transfixion alaire" }),
      st("p8", 56, "vaccination", "Newcastle + bronchite (rappel)", { route: "Eau de boisson" }),
      st("p9", 70, "deparasitage", "Déparasitage"),
      st("p10", 112, "vaccination", "Newcastle + bronchite + EDS (vaccin inactivé)", { route: "Injection IM" }),
      st("p11", 126, "deparasitage", "Déparasitage avant l'entrée en ponte"),
    ]),
    p("pgm-chiot", "PRO-0003", "Chiot : vaccins et déparasitages", "Chien", "Chiot", "Naissance (J0)", [
      st("d1", 14, "deparasitage", "Déparasitage (2 semaines)"),
      st("d2", 28, "deparasitage", "Déparasitage (4 semaines)"),
      st("d3", 42, "vaccination", "CHPPi (1re injection)", { route: "SC" }),
      st("d4", 42, "deparasitage", "Déparasitage (6 semaines)"),
      st("d5", 70, "vaccination", "CHPPiL (rappel)", { route: "SC" }),
      st("d6", 90, "vaccination", "Rage", { route: "SC", note: "À partir de 3 mois, avec certificat" }),
      st("d7", 120, "deparasitage", "Déparasitage (4 mois)"),
      st("d8", 455, "vaccination", "Rappel annuel CHPPiL + rage", { route: "SC" }),
    ]),
    p("pgm-chaton", "PRO-0004", "Chaton : vaccins et déparasitages", "Chat", "Chaton", "Naissance (J0)", [
      st("t1", 28, "deparasitage", "Déparasitage (4 semaines)"),
      st("t2", 56, "vaccination", "Typhus + coryza (1re injection)", { route: "SC" }),
      st("t3", 56, "deparasitage", "Déparasitage (8 semaines)"),
      st("t4", 84, "vaccination", "Typhus + coryza (rappel)", { route: "SC" }),
      st("t5", 90, "vaccination", "Rage", { route: "SC", note: "À partir de 3 mois, avec certificat" }),
      st("t6", 450, "vaccination", "Rappel annuel typhus, coryza, rage", { route: "SC" }),
    ]),
    p("pgm-bovin", "PRO-0005", "Bovins : programme annuel", "Bovin", "Troupeau", "Début du programme (J0)", [
      st("b1", 0, "deparasitage", "Déparasitage interne", { product: "Ivermectine 1 %", dose: "1 mL/50 kg", route: "SC" }),
      st("b2", 0, "vaccination", "Charbon symptomatique et bactéridien"),
      st("b3", 14, "vaccination", "Pasteurellose"),
      st("b4", 30, "deparasitage", "Détiquage", { route: "Bain ou pour-on" }),
      st("b5", 90, "deparasitage", "Détiquage", { route: "Bain ou pour-on" }),
      st("b6", 180, "deparasitage", "Déparasitage interne"),
      st("b7", 365, "vaccination", "Rappel annuel des vaccins"),
    ]),
    p("pgm-pr", "PRO-0006", "Ovins et caprins : programme annuel", "Caprin", "Petits ruminants", "Début du programme (J0)", [
      st("o1", 0, "vaccination", "Peste des petits ruminants (PPR)", { route: "SC" }),
      st("o2", 0, "deparasitage", "Déparasitage interne"),
      st("o3", 14, "vaccination", "Pasteurellose"),
      st("o4", 90, "deparasitage", "Déparasitage interne"),
      st("o5", 180, "deparasitage", "Déparasitage interne"),
      st("o6", 365, "vaccination", "Rappel pasteurellose"),
    ]),
    p("pgm-porc", "PRO-0007", "Porcelets : de la naissance à l'engraissement", "Porcin", "Porcelets", "Naissance (J0)", [
      st("r1", 3, "autre", "Fer injectable", { route: "IM" }),
      st("r2", 28, "vitamines", "Vitamines au sevrage"),
      st("r3", 42, "deparasitage", "Déparasitage"),
      st("r4", 70, "vaccination", "Rouget (si pratiqué dans l'élevage)"),
      st("r5", 90, "deparasitage", "Déparasitage avant engraissement"),
    ]),
  ];
}
