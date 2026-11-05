/**
 * Suivi des traitements : prises prévues, prises réalisées (équipe ou propriétaire),
 * observance, retards et évolution clinique.
 */
import type { DemoDB, TreatmentCourse } from "./types";

export const TREND_META = {
  amelioration: { label: "Amélioration", chip: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-300" },
  stable: { label: "Stable", chip: "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300" },
  aggravation: { label: "Aggravation", chip: "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-300" },
  gueri: { label: "Guéri", chip: "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300" },
} as const;

export const SLOT_PRESETS: Record<number, string[]> = { 1: ["08:00"], 2: ["08:00", "20:00"], 3: ["08:00", "14:00", "20:00"], 4: ["06:00", "12:00", "18:00", "24:00"] };

export const addDay = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00`);
  x.setDate(x.getDate() + n);
  const p = (k: number) => String(k).padStart(2, "0");
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
};

export const courseEnd = (c: TreatmentCourse) => addDay(c.startDate, c.days - 1);

export interface SlotState {
  day: string;
  slot: string;
  due: boolean; // l'horaire est passé
  log?: TreatmentCourse["doses"][number];
}

/** Grille jour × créneau, avec ce qui a été saisi. `now` au format AAAA-MM-JJTHH:MM. */
export function slotGrid(c: TreatmentCourse, now: string): SlotState[] {
  const out: SlotState[] = [];
  for (let i = 0; i < c.days; i++) {
    const day = addDay(c.startDate, i);
    for (const slot of c.slots) {
      const at = `${day}T${slot === "24:00" ? "23:59" : slot}`;
      out.push({ day, slot, due: at <= now, log: c.doses.find((d) => d.day === day && d.slot === slot) });
    }
  }
  return out;
}

export interface CourseStats {
  planned: number;
  due: number;
  given: number;
  missed: number; // déclarées manquées ou refusées
  overdue: number; // échues sans aucune saisie
  rate: number | null; // observance (données / échues)
  lastNews?: string;
  trend?: TreatmentCourse["evolution"][number];
  ended: boolean;
  todayDue: number;
  todayGiven: number;
}

export function courseStats(c: TreatmentCourse, now: string): CourseStats {
  const grid = slotGrid(c, now);
  const today = now.slice(0, 10);
  const due = grid.filter((g) => g.due);
  const given = due.filter((g) => g.log?.status === "donne").length;
  const missed = due.filter((g) => g.log && g.log.status !== "donne").length;
  const overdue = c.status === "actif" ? due.filter((g) => !g.log).length : 0;
  const news = [...c.doses.map((d) => d.at), ...c.evolution.map((e) => e.date)].sort().pop();
  const trend = [...c.evolution].sort((a, b) => a.date.localeCompare(b.date)).pop();
  return {
    planned: grid.length,
    due: due.length,
    given,
    missed,
    overdue,
    rate: due.length ? Math.round((given / due.length) * 100) : null,
    lastNews: news,
    trend,
    ended: c.status !== "actif" || courseEnd(c) < today,
    todayDue: grid.filter((g) => g.day === today && g.due).length,
    todayGiven: grid.filter((g) => g.day === today && g.log?.status === "donne").length,
  };
}

/** Traitements en cours (actifs et non terminés à la date du jour). */
export const activeCourses = (db: DemoDB, today: string) => (db.treatments ?? []).filter((c) => c.status === "actif" && c.startDate <= today && courseEnd(c) >= addDay(today, -1));

/** Jours sans nouvelles d'un traitement à domicile. */
export function daysWithoutNews(c: TreatmentCourse, today: string) {
  const s = courseStats(c, `${today}T23:59`);
  const ref = (s.lastNews ?? c.startDate).slice(0, 10);
  return Math.max(0, Math.round((new Date(`${today}T00:00:00`).getTime() - new Date(`${ref}T00:00:00`).getTime()) / 86400000));
}

export const rateTone = (r: number | null) => (r === null ? "text-gray-500" : r >= 90 ? "text-success-600 dark:text-success-400" : r >= 70 ? "text-warning-600 dark:text-warning-400" : "text-error-600 dark:text-error-400");
