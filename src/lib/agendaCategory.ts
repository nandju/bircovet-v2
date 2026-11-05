/** Catégorie d'un rendez-vous pour l'agenda général (couleur et filtre). */
import { RENTE_SPECIES } from "./followup";
import { ruralTypeOf } from "./rural";
import type { Appointment, DemoDB, Mission } from "./types";

export type AgendaCat = "compagnie" | "rente" | "urgence";

export const AGENDA_COLORS: Record<AgendaCat, { label: string; block: string; dot: string; chip: string }> = {
  compagnie: { label: "Animaux de compagnie", block: "border-brand-300 bg-brand-50 text-brand-900 dark:border-brand-700 dark:bg-brand-500/15 dark:text-brand-100", dot: "bg-brand-500", chip: "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300" },
  rente: { label: "Animaux de rente", block: "border-orange-300 bg-orange-50 text-orange-900 dark:border-orange-700 dark:bg-orange-500/15 dark:text-orange-100", dot: "bg-orange-500", chip: "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300" },
  urgence: { label: "Urgence rurale", block: "border-error-300 bg-error-50 text-error-900 dark:border-error-700 dark:bg-error-500/15 dark:text-error-100", dot: "bg-error-500", chip: "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-300" },
};

export function apptCategory(db: DemoDB, a: Appointment): AgendaCat {
  const p = a.patientId ? db.patients.find((x) => x.id === a.patientId) : undefined;
  if (p) return RENTE_SPECIES.includes(p.species) ? "rente" : "compagnie";
  return db.farms.some((f) => f.clientId === a.clientId) ? "rente" : "compagnie";
}

export const missionCategory = (m: Mission): AgendaCat => (ruralTypeOf(m) === "urgence" ? "urgence" : "rente");

/** Missions présentes un jour donné (du début à la fin prévue). */
export const missionsOn = (missions: Mission[], day: string) => missions.filter((m) => m.status !== "annulee" && m.date.slice(0, 10) <= day && (m.endDate || m.date).slice(0, 10) >= day);
