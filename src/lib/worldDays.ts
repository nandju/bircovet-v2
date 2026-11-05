/**
 * Journées mondiales, fêtes et dates utiles à la communication du cabinet
 * (animaux, vétérinaires, alimentation, santé animale et humaine, fêtes).
 * Les dates fixes et les règles (« dernier samedi d'avril ») sont calculées pour
 * chaque année ; les fêtes religieuses lunaires sont indicatives.
 */

export type WorldDayCat = "animaux" | "veterinaire" | "alimentation" | "sante" | "fete";

export const WORLD_DAY_CATS: Record<WorldDayCat, { label: string; chip: string; dot: string }> = {
  animaux: { label: "Animaux", chip: "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300", dot: "bg-brand-500" },
  veterinaire: { label: "Vétérinaires", chip: "bg-tertiary-50 text-tertiary-700 dark:bg-tertiary-500/15 dark:text-tertiary-300", dot: "bg-tertiary-500" },
  alimentation: { label: "Alimentation", chip: "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-300", dot: "bg-warning-500" },
  sante: { label: "Maladies et One Health", chip: "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-300", dot: "bg-error-500" },
  fete: { label: "Fêtes et calendrier", chip: "bg-theme-purple-500/10 text-theme-purple-500", dot: "bg-theme-purple-500" },
};

type Rule =
  | { md: string } // "MM-DD"
  | { nth: number; weekday: number; month: number } // nth = -1 pour le dernier
  | { easter: number } // décalage en jours par rapport à Pâques
  | { fixed: Record<number, string> }; // dates indicatives par année (fêtes lunaires)

interface Def {
  id: string;
  title: string;
  cat: WorldDayCat;
  rule: Rule;
  /** Idée de publication pour la page du cabinet. */
  idea: string;
  /** Plusieurs jours (semaine mondiale…). */
  days?: number;
}

const DEFS: Def[] = [
  // Animaux
  { id: "faune", title: "Journée mondiale de la vie sauvage", cat: "animaux", rule: { md: "03-03" }, idea: "Faune sauvage et zoonoses : pourquoi ne pas garder un animal sauvage à la maison." },
  { id: "sterilisation", title: "Journée mondiale de la stérilisation (Spay Day)", cat: "animaux", rule: { nth: -1, weekday: 2, month: 2 }, idea: "Stérilisation chiennes et chattes : avantages santé, offre du mois au cabinet." },
  { id: "animaux-labo", title: "Journée mondiale des animaux de laboratoire", cat: "animaux", rule: { md: "04-24" }, idea: "Bien-être animal et éthique : le rôle du vétérinaire." },
  { id: "abeilles", title: "Journée mondiale des abeilles", cat: "animaux", rule: { md: "05-20" }, idea: "Les abeilles, pollinisateurs essentiels : apiculture et santé des ruches." },
  { id: "chat", title: "Journée internationale du chat", cat: "animaux", rule: { md: "08-08" }, idea: "Photo des chats patients du cabinet (avec accord) + 3 conseils vaccination et vermifugation." },
  { id: "chien", title: "Journée internationale du chien", cat: "animaux", rule: { md: "08-26" }, idea: "Rappel vaccination antirabique et vermifugation des chiens ; adoption responsable." },
  { id: "animaux-ferme", title: "Journée mondiale des animaux de ferme", cat: "animaux", rule: { md: "10-02" }, idea: "Bien-être en élevage : densité, eau, ventilation. Témoignage d'un éleveur suivi." },
  { id: "animaux", title: "Journée mondiale des animaux", cat: "animaux", rule: { md: "10-04" }, idea: "Les animaux qui nous entourent : chiens, chats, volailles, bétail. Portraits de patients." },
  // Vétérinaires
  { id: "veto", title: "Journée mondiale vétérinaire", cat: "veterinaire", rule: { nth: -1, weekday: 6, month: 4 }, idea: "Présentation de l'équipe du cabinet et de ses missions (compagnie, élevage, santé publique)." },
  { id: "one-health", title: "Journée One Health (Une seule santé)", cat: "veterinaire", rule: { md: "11-03" }, idea: "Santé humaine, animale et environnementale : le vétérinaire au cœur de la prévention." },
  { id: "amr", title: "Semaine mondiale de sensibilisation aux antimicrobiens", cat: "veterinaire", rule: { md: "11-18" }, days: 7, idea: "Antibiotiques : pas d'automédication en élevage, respect des doses et des délais d'attente." },
  // Alimentation
  { id: "lait", title: "Journée mondiale du lait", cat: "alimentation", rule: { md: "06-01" }, idea: "Qualité du lait : hygiène de la traite et santé de la mamelle." },
  { id: "securite-sanitaire", title: "Journée mondiale de la sécurité sanitaire des aliments", cat: "alimentation", rule: { md: "06-07" }, idea: "Viande, œufs, lait : du producteur au consommateur, le contrôle vétérinaire." },
  { id: "oeuf", title: "Journée mondiale de l'œuf", cat: "alimentation", rule: { nth: 2, weekday: 5, month: 10 }, idea: "L'œuf, protéine accessible : conseils aux éleveurs de pondeuses." },
  { id: "alimentation", title: "Journée mondiale de l'alimentation", cat: "alimentation", rule: { md: "10-16" }, idea: "Bien nourrir son animal : les erreurs fréquentes (restes de table, os cuits)." },
  { id: "peche", title: "Journée mondiale de la pêche", cat: "alimentation", rule: { md: "11-21" }, idea: "Pisciculture : qualité de l'eau et prévention des maladies des poissons." },
  { id: "sols", title: "Journée mondiale des sols", cat: "alimentation", rule: { md: "12-05" }, idea: "Fumier et lisier : valoriser les déjections d'élevage sans risque sanitaire." },
  { id: "eau", title: "Journée mondiale de l'eau", cat: "alimentation", rule: { md: "03-22" }, idea: "Eau de boisson en élevage : propreté des abreuvoirs et chloration." },
  // Santé humaine et animale
  { id: "mtn", title: "Journée mondiale des maladies tropicales négligées", cat: "sante", rule: { md: "01-30" }, idea: "Maladies négligées transmises par les animaux : prévention simple." },
  { id: "cancer", title: "Journée mondiale contre le cancer", cat: "sante", rule: { md: "02-04" }, idea: "Les tumeurs chez le chien et le chat : palper régulièrement son animal." },
  { id: "obesite", title: "Journée mondiale de l'obésité", cat: "sante", rule: { md: "03-04" }, idea: "Surpoids des animaux de compagnie : pesée gratuite au cabinet cette semaine." },
  { id: "tuberculose", title: "Journée mondiale de la tuberculose", cat: "sante", rule: { md: "03-24" }, idea: "Tuberculose bovine et humaine : lait bouilli, contrôle des troupeaux." },
  { id: "sante", title: "Journée mondiale de la santé", cat: "sante", rule: { md: "04-07" }, idea: "Une seule santé : vacciner ses animaux protège aussi la famille." },
  { id: "paludisme", title: "Journée mondiale de lutte contre le paludisme", cat: "sante", rule: { md: "04-25" }, idea: "Moustiques et eaux stagnantes autour des élevages : bons réflexes." },
  { id: "mains", title: "Journée mondiale de l'hygiène des mains", cat: "sante", rule: { md: "05-05" }, idea: "Se laver les mains après avoir manipulé les animaux et leurs litières." },
  { id: "environnement", title: "Journée mondiale de l'environnement", cat: "sante", rule: { md: "06-05" }, idea: "Gestion des cadavres et des déchets de soins en élevage." },
  { id: "zoonoses", title: "Journée mondiale des zoonoses", cat: "sante", rule: { md: "07-06" }, idea: "Rage, brucellose, salmonellose : ces maladies qui passent de l'animal à l'homme." },
  { id: "hepatite", title: "Journée mondiale contre l'hépatite", cat: "sante", rule: { md: "07-28" }, idea: "Hygiène alimentaire et prévention : message santé publique." },
  { id: "moustique", title: "Journée mondiale du moustique", cat: "sante", rule: { md: "08-20" }, idea: "Moustiques et maladies animales (dirofilariose) : protéger son chien." },
  { id: "rage", title: "Journée mondiale contre la rage", cat: "sante", rule: { md: "09-28" }, idea: "Campagne de vaccination antirabique : tarifs, horaires, conduite à tenir après une morsure." },
  { id: "lavage-mains", title: "Journée mondiale du lavage des mains", cat: "sante", rule: { md: "10-15" }, idea: "Hygiène à la ferme : pédiluve, tenue dédiée, lavage des mains." },
  { id: "diabete", title: "Journée mondiale du diabète", cat: "sante", rule: { md: "11-14" }, idea: "Le diabète existe aussi chez le chien et le chat : signes d'alerte." },
  { id: "sida", title: "Journée mondiale de lutte contre le sida", cat: "sante", rule: { md: "12-01" }, idea: "Message de solidarité santé publique." },
  { id: "epidemies", title: "Journée internationale de préparation aux épidémies", cat: "sante", rule: { md: "12-27" }, idea: "Grippe aviaire, peste porcine : biosécurité et déclaration rapide." },
  // Fêtes et calendrier général (Côte d'Ivoire)
  { id: "nouvel-an", title: "Nouvel An", cat: "fete", rule: { md: "01-01" }, idea: "Vœux du cabinet + rappel : feux d'artifice et animaux stressés." },
  { id: "saint-valentin", title: "Saint-Valentin", cat: "fete", rule: { md: "02-14" }, idea: "« Mon premier amour a quatre pattes » : photos des abonnés avec leur animal." },
  { id: "femmes", title: "Journée internationale des droits des femmes", cat: "fete", rule: { md: "03-08" }, idea: "Hommage aux femmes vétérinaires, assistantes et éleveuses." },
  { id: "travail", title: "Fête du Travail", cat: "fete", rule: { md: "05-01" }, idea: "Hommage à l'équipe du cabinet ; horaires du jour férié." },
  { id: "meres", title: "Fête des Mères", cat: "fete", rule: { nth: -1, weekday: 0, month: 5 }, idea: "Les mamans à quatre pattes : gestation et mise bas, conseils." },
  { id: "peres", title: "Fête des Pères", cat: "fete", rule: { nth: 3, weekday: 0, month: 6 }, idea: "Papa et son compagnon : photos des abonnés." },
  { id: "independance", title: "Fête de l'Indépendance de la Côte d'Ivoire", cat: "fete", rule: { md: "08-07" }, idea: "Message patriotique + horaires du jour férié." },
  { id: "assomption", title: "Assomption", cat: "fete", rule: { md: "08-15" }, idea: "Horaires du jour férié ; garde des animaux pendant les déplacements." },
  { id: "toussaint", title: "Toussaint", cat: "fete", rule: { md: "11-01" }, idea: "Horaires du jour férié." },
  { id: "paix", title: "Journée nationale de la Paix", cat: "fete", rule: { md: "11-15" }, idea: "Message de paix et de cohésion du cabinet." },
  { id: "noel", title: "Noël", cat: "fete", rule: { md: "12-25" }, idea: "Chocolat, os de volaille, décorations : les dangers des fêtes pour les animaux." },
  { id: "paques", title: "Lundi de Pâques", cat: "fete", rule: { easter: 1 }, idea: "Chocolat toxique pour les chiens : à garder hors de portée." },
  { id: "ascension", title: "Ascension", cat: "fete", rule: { easter: 39 }, idea: "Horaires du jour férié." },
  { id: "pentecote", title: "Lundi de Pentecôte", cat: "fete", rule: { easter: 50 }, idea: "Horaires du jour férié." },
  { id: "ramadan", title: "Fin du Ramadan (Korité) — date indicative", cat: "fete", rule: { fixed: { 2026: "03-20", 2027: "03-10", 2028: "02-27" } }, idea: "Vœux du cabinet ; horaires du jour férié." },
  { id: "tabaski", title: "Tabaski — date indicative", cat: "fete", rule: { fixed: { 2026: "05-27", 2027: "05-17", 2028: "05-05" } }, idea: "Choisir un mouton en bonne santé, abattage hygiénique, contrôle des carcasses." },
  { id: "maouloud", title: "Maouloud — date indicative", cat: "fete", rule: { fixed: { 2026: "08-26", 2027: "08-15", 2028: "08-04" } }, idea: "Vœux du cabinet ; horaires du jour férié." },
];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** Dimanche de Pâques (algorithme de Meeus/Jones/Butcher). */
function easter(y: number) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(y, month - 1, day));
}

function dateOf(rule: Rule, y: number): string | null {
  if ("md" in rule) return `${y}-${rule.md}`;
  if ("fixed" in rule) return rule.fixed[y] ? `${y}-${rule.fixed[y]}` : null;
  if ("easter" in rule) {
    const d = easter(y);
    d.setUTCDate(d.getUTCDate() + rule.easter);
    return d.toISOString().slice(0, 10);
  }
  const { nth, weekday, month } = rule;
  if (nth > 0) {
    const first = new Date(Date.UTC(y, month - 1, 1)).getUTCDay();
    return iso(y, month, 1 + ((weekday - first + 7) % 7) + (nth - 1) * 7);
  }
  const lastDay = new Date(Date.UTC(y, month, 0));
  const back = (lastDay.getUTCDay() - weekday + 7) % 7;
  return iso(y, month, lastDay.getUTCDate() - back);
}

export interface WorldDay {
  id: string;
  date: string;
  end: string;
  title: string;
  cat: WorldDayCat;
  idea: string;
}

const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

/** Toutes les journées entre deux dates incluses (AAAA-MM-JJ). */
export function worldDaysBetween(from: string, to: string, cats?: WorldDayCat[]): WorldDay[] {
  const out: WorldDay[] = [];
  for (let y = Number(from.slice(0, 4)) - 1; y <= Number(to.slice(0, 4)); y++) {
    for (const d of DEFS) {
      if (cats && !cats.includes(d.cat)) continue;
      const date = dateOf(d.rule, y);
      if (!date) continue;
      const end = d.days ? addDays(date, d.days - 1) : date;
      if (end >= from && date <= to) out.push({ id: `${d.id}-${y}`, date, end, title: d.title, cat: d.cat, idea: d.idea });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export const worldDaysOn = (list: WorldDay[], day: string) => list.filter((w) => w.date <= day && w.end >= day);

/** Prochaines journées (par défaut 45 jours) pour préparer la communication. */
export const upcomingWorldDays = (today: string, horizon = 45, cats?: WorldDayCat[]) => worldDaysBetween(today, addDays(today, horizon), cats);

/** Texte de publication prêt à adapter (page Facebook / WhatsApp du cabinet). */
export function postDraft(w: WorldDay, clinic: string) {
  return `${w.title} 🐾\n\n${w.idea}\n\nVotre cabinet ${clinic} est à vos côtés pour la santé de vos animaux. Contactez-nous pour toute question.`;
}

export const WORLD_DAY_COUNT = DEFS.length;
