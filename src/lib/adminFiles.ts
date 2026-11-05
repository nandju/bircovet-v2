/** Suivi des dossiers administratifs : priorités, échéances, obligations récurrentes. */
import type { AdminFile, AdminObligation, DemoDB } from "./types";

export const ADMIN_STATUS: Record<AdminFile["status"], { label: string; chip: string }> = {
  a_faire: { label: "À faire", chip: "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300" },
  en_cours: { label: "En cours", chip: "bg-tertiary-50 text-tertiary-700 dark:bg-tertiary-500/15 dark:text-tertiary-300" },
  en_retard: { label: "En retard", chip: "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-300" },
  complet: { label: "Complet", chip: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-300" },
};

export type Priority = "retard" | "urgent" | "avenir" | "ok" | "fait";
export const PRIORITY: Record<Priority, { label: string; chip: string; dot: string }> = {
  retard: { label: "En retard", chip: "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-300", dot: "bg-error-500" },
  urgent: { label: "Urgent (30 j)", chip: "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300", dot: "bg-orange-500" },
  avenir: { label: "À venir (60 j)", chip: "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-300", dot: "bg-warning-400" },
  ok: { label: "Dans les temps", chip: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300", dot: "bg-gray-300" },
  fait: { label: "Complété", chip: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-300", dot: "bg-success-500" },
};

export const daysLeft = (due: string | undefined, today: string) => (due ? Math.round((new Date(`${due}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000) : null);

export function priorityOf(f: AdminFile, today: string): Priority {
  if (f.status === "complet") return "fait";
  const d = daysLeft(f.dueDate, today);
  if (f.status === "en_retard" || (d !== null && d < 0)) return "retard";
  if (d !== null && d <= 30) return "urgent";
  if (d !== null && d <= 60) return "avenir";
  return "ok";
}

export function adminSummary(db: DemoDB, today: string) {
  const files = db.adminFiles ?? [];
  const by = (p: Priority) => files.filter((f) => priorityOf(f, today) === p);
  const cats = [...new Set(files.map((f) => f.category))].map((c) => {
    const xs = files.filter((f) => f.category === c);
    return { category: c, total: xs.length, done: xs.filter((f) => f.status === "complet").length, ongoing: xs.filter((f) => f.status === "en_cours" || f.status === "a_faire").length, late: xs.filter((f) => priorityOf(f, today) === "retard").length };
  });
  return {
    late: by("retard"),
    urgent: by("urgent"),
    soon: by("avenir"),
    ongoing: files.filter((f) => f.status === "en_cours"),
    done: by("fait"),
    cats,
    withoutLink: files.filter((f) => !f.driveUrl && f.status !== "complet").length,
  };
}

/** Prochaine échéance d'une obligation récurrente (cette année ou la suivante). */
export function nextObligationDate(o: AdminObligation, today: string) {
  if (!o.dueMonth || !o.dueDay) return undefined;
  const y = Number(today.slice(0, 4));
  const mk = (yy: number) => `${yy}-${String(o.dueMonth).padStart(2, "0")}-${String(o.dueDay).padStart(2, "0")}`;
  return mk(y) >= today ? mk(y) : mk(y + 1);
}

export const isGoogleDrive = (u?: string) => !!u && /^https:\/\/(drive|docs)\.google\.com\//i.test(u.trim());
