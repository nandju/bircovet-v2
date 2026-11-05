import type { DemoDB, Expense, Project, ProjectStatus } from "./types";

export const PROJECT_STATUS: Record<ProjectStatus, { label: string; tone: string }> = {
  en_cours: { label: "En cours", tone: "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300" },
  suspendu: { label: "Suspendu", tone: "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-300" },
  termine: { label: "Terminé", tone: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400" },
};

/** Nombre de preuves d'une dépense (fichier joint, photos, liens). */
export const proofCount = (e: Expense) => (e.attachmentDataUrl ? 1 : 0) + (e.photos?.length ?? 0) + (e.proofLinks?.length ?? 0);

/** Dépenses d'un projet et totaux (les dépenses rejetées ne comptent pas). */
export function projectSpend(db: DemoDB, p: Pick<Project, "id" | "budget">) {
  const list = db.expenses.filter((e) => e.projectId === p.id && e.status !== "rejetee");
  const spent = list.filter((e) => e.status === "approuvee").reduce((s, e) => s + e.amount, 0);
  const pending = list.filter((e) => e.status === "en_attente").reduce((s, e) => s + e.amount, 0);
  const withoutProof = list.filter((e) => proofCount(e) === 0).length;
  const left = p.budget ? p.budget - spent - pending : undefined;
  const pct = p.budget ? Math.round(((spent + pending) / p.budget) * 100) : undefined;
  return { list, spent, pending, withoutProof, left, pct };
}
