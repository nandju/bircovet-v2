/**
 * Types d'activité identifiés par une icône (agenda, tableau de bord, rapports) :
 * vaccination, maladie, alimentation, visite, consultation, rapport, mission…
 */
import { ruralTypeOf } from "./rural";
import type { Appointment, Mission } from "./types";

export type ActivityKind = "domicile" | "consultation" | "vaccination" | "maladie" | "alimentation" | "chirurgie" | "suivi" | "visite" | "mission" | "urgence" | "rapport";

export const ACTIVITY_KINDS: { key: ActivityKind; label: string; tone: string }[] = [
  { key: "consultation", label: "Consultation", tone: "text-brand-600 dark:text-brand-400" },
  { key: "domicile", label: "Consultation à domicile", tone: "text-theme-pink-500" },
  { key: "vaccination", label: "Vaccination", tone: "text-tertiary-600 dark:text-tertiary-400" },
  { key: "maladie", label: "Maladie / soins", tone: "text-error-600 dark:text-error-400" },
  { key: "alimentation", label: "Alimentation", tone: "text-warning-600 dark:text-warning-400" },
  { key: "chirurgie", label: "Chirurgie", tone: "text-theme-purple-500" },
  { key: "suivi", label: "Contrôle / suivi", tone: "text-success-600 dark:text-success-400" },
  { key: "visite", label: "Visite de ferme", tone: "text-orange-600 dark:text-orange-400" },
  { key: "mission", label: "Mission", tone: "text-orange-600 dark:text-orange-400" },
  { key: "urgence", label: "Urgence", tone: "text-error-600 dark:text-error-400" },
  { key: "rapport", label: "Rapport", tone: "text-gray-600 dark:text-gray-300" },
];
export const kindMeta = (k: ActivityKind) => ACTIVITY_KINDS.find((x) => x.key === k)!;

const RULES: [RegExp, ActivityKind][] = [
  [/vaccin|rappel|antirabique|newcastle|gumboro/i, "vaccination"],
  [/chirurg|st[ée]ril|castration|op[ée]ration|d[ée]tartrage/i, "chirurgie"],
  [/aliment|nutrition|ration|r[ée]gime|ob[ée]sit/i, "alimentation"],
  [/contr[ôo]le|suivi|post-op|pansement|r[ée]vision/i, "suivi"],
  [/urgence/i, "urgence"],
  [/visite/i, "visite"],
  [/rapport/i, "rapport"],
  [/trouble|boiterie|diarrh|vomiss|toux|fi[èe]vre|plaie|infection|parasit|vermifug|dermat|otite|maladie|douleur/i, "maladie"],
];

export function kindFromText(text: string, fallback: ActivityKind = "consultation"): ActivityKind {
  for (const [re, k] of RULES) if (re.test(text)) return k;
  return fallback;
}

export const apptKind = (a: Appointment): ActivityKind => (a.home ? "domicile" : a.kind ?? kindFromText(a.reason));

export function missionKind(m: Mission): ActivityKind {
  const t = ruralTypeOf(m);
  if (t === "urgence") return "urgence";
  if (t === "visite") return "visite";
  return "mission";
}
