import { addDays } from "./format";
import type { CareCase, CareReason, CareScope, CareStatus, DemoDB, Farm } from "./types";

export const CARE_REASON: Record<CareReason, { label: string; hint: string; emoji: string; days: number }> = {
  appel: { label: "Appel : un animal ne va pas", hint: "Examen et traitement d'un animal malade", emoji: "📞", days: 2 },
  visite_routine: { label: "Visite de routine", hint: "Contrôle de l'état du cheptel", emoji: "🔎", days: 30 },
  traitement_routine: { label: "Traitement de routine", hint: "Vaccination, déparasitage, vitamines…", emoji: "💉", days: 14 },
  pathologie: { label: "Pathologie : tout le cheptel", hint: "Prise en charge après un diagnostic", emoji: "🚨", days: 3 },
};
export const CARE_SCOPE: Record<CareScope, string> = { animal: "Un animal", lot: "Une bande / un lot", cheptel: "Tout le cheptel d'une espèce" };
export const CARE_STATUS: Record<CareStatus, { label: string; tone: string }> = {
  en_cours: { label: "Sous prise en charge", tone: "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300" },
  gueri: { label: "Guéri", tone: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-300" },
  deces: { label: "Décès", tone: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400" },
  cloture: { label: "Clôturé", tone: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400" },
};
export const FOLLOW_STATE: Record<string, { label: string; tone: string }> = {
  amelioration: { label: "En amélioration", tone: "text-success-600" },
  stable: { label: "Stable", tone: "text-gray-600 dark:text-gray-400" },
  aggravation: { label: "Aggravation", tone: "text-error-600" },
  gueri: { label: "Guéri", tone: "text-success-700" },
  deces: { label: "Décès", tone: "text-gray-500" },
};
export const ADVICE_CHIPS = ["Isoler les animaux malades", "Nettoyer et désinfecter le local", "Eau propre à volonté", "Respecter le délai d'attente (lait, viande)", "Surveiller l'appétit et la température", "Rappeler le cabinet en cas d'aggravation", "Renforcer l'alimentation", "Changer la litière"];

export const lotHeadcount = (f: Farm, lotId: string) => {
  const h = f.headcounts.filter((x) => x.lotId === lotId).sort((a, b) => b.date.localeCompare(a.date))[0];
  return h?.count ?? 0;
};
export const speciesHeadcount = (f: Farm, species: string, norm: (s: string) => string) => f.lots.filter((l) => l.status === "actif" && norm(l.species) === species).reduce((s, l) => s + lotHeadcount(f, l.id), 0);

export const careDue = (c: CareCase, today: string) => c.status === "en_cours" && !!c.nextCheck && c.nextCheck <= today;
export const casesDue = (db: DemoDB, today: string) => (db.careCases ?? []).filter((c) => careDue(c, today));
export const defaultNextCheck = (reason: CareReason, from: string) => addDays(from, CARE_REASON[reason].days);

/** Libellé court de ce qui est pris en charge. */
export function careTarget(db: DemoDB, c: CareCase) {
  const f = db.farms.find((x) => x.id === c.farmId);
  if (c.scope === "animal") {
    const a = f?.animals?.find((x) => x.id === c.animalId);
    return a ? `${c.species} n° ${a.tag}${a.name ? ` (${a.name})` : ""}` : c.species;
  }
  if (c.scope === "lot") return `${f?.lots.find((l) => l.id === c.lotId)?.name ?? "Lot"} · ${c.count} ${c.species.toLowerCase()}(s)`;
  return `Tout le cheptel ${c.species.toLowerCase()} · ${c.count} animaux`;
}

/** Texte du rapport de visite tiré d'une prise en charge. */
export function careSummary(db: DemoDB, c: CareCase) {
  const parts = [
    `${CARE_REASON[c.reason].label} — ${careTarget(db, c)}.`,
    c.complaint && `Motif : ${c.complaint}.`,
    [c.exam.temperature && `T° ${c.exam.temperature} °C`, c.exam.heartRate && `FC ${c.exam.heartRate}/min`, c.exam.respRate && `FR ${c.exam.respRate}/min`].filter(Boolean).join(", "),
    c.exam.findings && `Examen : ${c.exam.findings}.`,
    c.diagnosis && `Diagnostic : ${c.diagnosis}.`,
    c.treatments.length && `Traitement : ${c.treatments.map((t) => [t.product, t.dose, t.route, t.duration && `pendant ${t.duration}`, t.count && `${t.count} animal(aux)`].filter(Boolean).join(" ")).join(" ; ")}.`,
    c.advice && `Conseils : ${c.advice}`,
  ];
  return parts.filter(Boolean).join("\n");
}
