/**
 * Profil d'une exploitation : cheptel par espèce, catégorie d'éleveur
 * (petit / moyen / gros) d'après l'effectif et le chiffre d'affaires généré.
 */
import { docTotal, isActiveInvoice } from "./calc";
import { addDays } from "./format";
import type { DemoDB, Farm, FarmScaleSettings } from "./types";

export const HERD = ["Volaille", "Bovin", "Ovin", "Caprin", "Porcin", "Lapin", "Poisson", "Équidé"] as const;

const NORMALIZE: [RegExp, (typeof HERD)[number]][] = [
  [/volaill|poule|poulet|pondeu|chair|pintade|caille|dinde|canard|oie/i, "Volaille"],
  [/bovin|z[ée]bu|vache|taur|veau|boeuf|bœuf/i, "Bovin"],
  [/ovin|mouton|brebis|b[ée]lier|djallonk/i, "Ovin"],
  [/caprin|ch[èe]vre|bouc|cabri/i, "Caprin"],
  [/porc|truie|verrat|porcelet/i, "Porcin"],
  [/lapin|lapere/i, "Lapin"],
  [/poisson|tilapia|silure|clarias|carpe|piscic/i, "Poisson"],
  [/cheval|[âa]ne|[ée]quid/i, "Équidé"],
];

export function speciesOf(text: string): string {
  for (const [re, s] of NORMALIZE) if (re.test(text)) return s;
  return text || "Autre";
}

/** Seuils (effectif) au-delà desquels un élevage est « moyen » puis « gros ». */
export const SCALE_THRESHOLDS: Record<string, [number, number]> = {
  Volaille: [1000, 5000],
  Bovin: [20, 100],
  Ovin: [50, 200],
  Caprin: [50, 200],
  Porcin: [50, 300],
  Lapin: [200, 1000],
  Poisson: [2000, 20000],
  Équidé: [5, 20],
  Autre: [50, 300],
};
/** Chiffre d'affaires sur 12 mois (FCFA) : moyen puis gros client. */
export const REVENUE_THRESHOLDS: [number, number] = [300_000, 1_500_000];

export type Scale = "petit" | "moyen" | "gros";
export const DEFAULT_LABELS: Record<Scale, string> = { petit: "Petit éleveur", moyen: "Moyen éleveur", gros: "Gros éleveur" };
export const SCALE_META: Record<Scale, { label: string; chip: string }> = {
  petit: { label: "Petit éleveur", chip: "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300" },
  moyen: { label: "Moyen éleveur", chip: "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300" },
  gros: { label: "Gros éleveur", chip: "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300" },
};
const RANK: Scale[] = ["petit", "moyen", "gros"];
const tier = (n: number, [a, b]: [number, number]): Scale => (n >= b ? "gros" : n >= a ? "moyen" : "petit");

export interface HerdLine {
  species: string;
  count: number;
  lots: number;
}

const currentHeadcount = (f: Farm, lotId: string) => f.headcounts.filter((h) => h.lotId === lotId).sort((a, b) => b.date.localeCompare(a.date))[0]?.count ?? 0;

export function farmHerd(f: Farm): HerdLine[] {
  const m = new Map<string, HerdLine>();
  for (const l of f.lots.filter((x) => x.status === "actif")) {
    const s = speciesOf(l.species);
    const e = m.get(s) ?? { species: s, count: 0, lots: 0 };
    e.count += currentHeadcount(f, l.id);
    e.lots += 1;
    m.set(s, e);
  }
  return [...m.values()].sort((a, b) => b.count - a.count);
}

export const herdLabel = (h: HerdLine[]) => h.map((x) => `${x.species} ${x.count.toLocaleString("fr-FR")}`).join(" · ") || "—";

/** Chiffre d'affaires généré par le client de l'exploitation sur 12 mois. */
export function clientRevenue12m(db: DemoDB, clientId: string, today: string) {
  const from = addDays(today, -365);
  return db.invoices.filter((i) => i.clientId === clientId && i.kind === "facture" && isActiveInvoice(i) && i.date >= from).reduce((s, i) => s + docTotal(i.lines), 0);
}

/** Réglages effectifs (paramètres du cabinet, sinon valeurs par défaut). */
export function scaleSettings(db: DemoDB): FarmScaleSettings {
  const s = db.settings.farmScale;
  return {
    herd: { ...SCALE_THRESHOLDS, ...(s?.herd ?? {}) },
    revenue: s?.revenue ?? REVENUE_THRESHOLDS,
    useRevenue: s?.useRevenue ?? true,
    labels: { ...DEFAULT_LABELS, ...(s?.labels ?? {}) },
  };
}

export function scaleLabel(db: DemoDB, s: Scale) {
  return scaleSettings(db).labels[s];
}

export function farmScale(db: DemoDB, f: Farm, today: string) {
  const cfg = scaleSettings(db);
  const herd = farmHerd(f);
  const herdTier = herd.reduce<Scale>((best, h) => {
    const t = tier(h.count, cfg.herd[h.species] ?? cfg.herd.Autre ?? SCALE_THRESHOLDS.Autre);
    return RANK.indexOf(t) > RANK.indexOf(best) ? t : best;
  }, "petit");
  const revenue = clientRevenue12m(db, f.clientId, today);
  const revenueTier = tier(revenue, cfg.revenue);
  const computed = cfg.useRevenue && RANK.indexOf(revenueTier) > RANK.indexOf(herdTier) ? revenueTier : herdTier;
  const scale = f.scaleOverride?.scale ?? computed;
  return { scale, computed, manual: !!f.scaleOverride, herdTier, revenueTier, revenue, herd };
}

export function farmTypeFromHerd(species: string[]): Farm["type"] {
  const s = [...new Set(species.map(speciesOf))];
  if (s.length !== 1) return "mixte";
  return ({ Volaille: "avicole", Bovin: "bovin", Porcin: "porcin", Ovin: "ovin_caprin", Caprin: "ovin_caprin", Poisson: "piscicole" } as Record<string, Farm["type"]>)[s[0]] ?? "mixte";
}

export const INTERVENTION_KINDS: { value: string; label: string }[] = [
  { value: "vaccination", label: "Vaccination" },
  { value: "traitement", label: "Traitement" },
  { value: "deparasitage", label: "Déparasitage" },
  { value: "prelevement", label: "Prélèvement" },
  { value: "analyse", label: "Analyse de laboratoire" },
  { value: "autopsie", label: "Autopsie" },
  { value: "conseil", label: "Conseil / formation" },
  { value: "autre", label: "Autre" },
];

/** Lien Google Maps valide (lien court de partage ou URL google.com/maps). */
export const isMapsUrl = (u: string) => /^https:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|(www\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+)\b/i.test(u.trim());

/** Lien Google Maps de l'exploitation, ou construit à partir des coordonnées GPS. */
export function mapsLink(f: Pick<Farm, "mapsUrl" | "gps" | "name" | "location">) {
  if (f.mapsUrl) return f.mapsUrl;
  const m = f.gps?.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (m) return `https://www.google.com/maps/search/?api=1&query=${m[1]},${m[2]}`;
  return f.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${f.name} ${f.location}`)}` : undefined;
}
