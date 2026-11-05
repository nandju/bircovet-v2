/** Gestion du personnel : congés, permissions, absences et objectifs. */
import type { DemoDB, LeaveKind, LeaveRequest, StaffEvaluation, StaffObjective } from "./types";

/** Congés annuels de référence (jours ouvrables par an, modifiable ici). */
export const ANNUAL_LEAVE_DAYS = 26;

export const LEAVE_META: Record<LeaveKind, { label: string; chip: string; dot: string }> = {
  conge: { label: "Congé annuel", chip: "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300", dot: "bg-brand-500" },
  permission: { label: "Permission", chip: "bg-tertiary-50 text-tertiary-700 dark:bg-tertiary-500/15 dark:text-tertiary-300", dot: "bg-tertiary-500" },
  maladie: { label: "Arrêt maladie", chip: "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-300", dot: "bg-error-500" },
  formation: { label: "Formation", chip: "bg-theme-purple-500/10 text-theme-purple-500", dot: "bg-theme-purple-500" },
  autre: { label: "Autre absence", chip: "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300", dot: "bg-gray-400" },
};

export const LEAVE_STATUS: Record<LeaveRequest["status"], { label: string; chip: string }> = {
  en_attente: { label: "En attente", chip: "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-300" },
  approuvee: { label: "Approuvée", chip: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-300" },
  refusee: { label: "Refusée", chip: "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-300" },
  annulee: { label: "Annulée", chip: "bg-gray-100 text-gray-500 dark:bg-white/10" },
};

/** Jours ouvrables (lundi → samedi) entre deux dates incluses. */
export function workingDays(start: string, end: string) {
  let n = 0;
  const d = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  while (d <= e) {
    if (d.getDay() !== 0) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

export const leaveDays = (l: LeaveRequest) => (l.hours ? 0 : workingDays(l.start, l.end));

export function leaveBalance(db: DemoDB, userId: string, year: string) {
  const mine = (db.leaves ?? []).filter((l) => l.userId === userId && l.start.startsWith(year));
  const taken = mine.filter((l) => l.kind === "conge" && l.status === "approuvee").reduce((s, l) => s + leaveDays(l), 0);
  const pending = mine.filter((l) => l.kind === "conge" && l.status === "en_attente").reduce((s, l) => s + leaveDays(l), 0);
  const permissions = mine.filter((l) => l.kind === "permission" && l.status === "approuvee").length;
  const sick = mine.filter((l) => l.kind === "maladie" && l.status === "approuvee").reduce((s, l) => s + leaveDays(l), 0);
  return { taken, pending, left: ANNUAL_LEAVE_DAYS - taken, permissions, sick };
}

export const absentOn = (db: DemoDB, day: string) => (db.leaves ?? []).filter((l) => l.status === "approuvee" && l.start <= day && l.end >= day);

export const objectiveProgress = (o: StaffObjective) => (o.target > 0 ? Math.min(100, Math.round((o.current / o.target) * 100)) : 0);

export function objectiveState(o: StaffObjective, today: string): "atteint" | "en_retard" | "a_risque" | "en_cours" | "clos" {
  if (o.status === "atteint" || o.current >= o.target) return "atteint";
  if (o.status !== "en_cours") return "clos";
  if (o.dueDate < today) return "en_retard";
  const days = (new Date(`${o.dueDate}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000;
  return days <= 14 && objectiveProgress(o) < 70 ? "a_risque" : "en_cours";
}

export const OBJ_STATE: Record<ReturnType<typeof objectiveState>, { label: string; chip: string; bar: string }> = {
  atteint: { label: "Atteint", chip: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-300", bar: "bg-success-500" },
  en_retard: { label: "Échéance dépassée", chip: "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-300", bar: "bg-error-500" },
  a_risque: { label: "À risque", chip: "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-300", bar: "bg-warning-500" },
  en_cours: { label: "En cours", chip: "bg-tertiary-50 text-tertiary-700 dark:bg-tertiary-500/15 dark:text-tertiary-300", bar: "bg-tertiary-500" },
  clos: { label: "Clos", chip: "bg-gray-100 text-gray-500 dark:bg-white/10", bar: "bg-gray-400" },
};

/** Critères de notation du personnel (1 à 5). */
export const EVAL_CRITERIA: { key: string; label: string }[] = [
  { key: "ponctualite", label: "Ponctualité et assiduité" },
  { key: "qualite", label: "Qualité du travail" },
  { key: "protocoles", label: "Respect des protocoles et de l'hygiène" },
  { key: "client", label: "Relation client" },
  { key: "equipe", label: "Esprit d'équipe" },
  { key: "initiative", label: "Initiative et autonomie" },
];

export const evalAverage = (e: StaffEvaluation) => {
  const v = Object.values(e.scores).filter((x) => x > 0);
  return v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10 : 0;
};

export const lastEvaluation = (db: DemoDB, userId: string) => [...(db.evaluations ?? [])].filter((e) => e.userId === userId).sort((a, b) => b.date.localeCompare(a.date))[0];
