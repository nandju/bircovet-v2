/**
 * Index des molécules (Formulaire BIRCOVET) : regroupe les fiches par principe actif,
 * expose les posologies calculables par espèce et les paramètres des espèces.
 * Le produit ne porte jamais de posologie : elle vient toujours de la molécule.
 */
import base from "./formulaire-base.json";

export type SpeciesCode = "ch" | "ca" | "la" | "bo" | "ov" | "cp" | "eq" | "po";
export type MoleculeStatus = "brouillon" | "a_valider" | "valide" | "retire";
export type AlertLevel = "info" | "warn" | "danger";

export interface SpeciesInfo {
  code: SpeciesCode;
  name: string;
  rente: boolean;
  defaultKg: number;
  /** Volume maximal par point d'injection IM/SC (mL), animaux de rente. */
  maxSiteMl?: number;
}

export const SPECIES: SpeciesInfo[] = [
  { code: "ch", name: "Chien", rente: false, defaultKg: 10 },
  { code: "ca", name: "Chat", rente: false, defaultKg: 4 },
  { code: "la", name: "Lapin", rente: false, defaultKg: 2 },
  { code: "bo", name: "Bovin", rente: true, defaultKg: 300, maxSiteMl: 20 },
  { code: "ov", name: "Ovin", rente: true, defaultKg: 35, maxSiteMl: 5 },
  { code: "cp", name: "Caprin", rente: true, defaultKg: 30, maxSiteMl: 5 },
  { code: "eq", name: "Cheval", rente: true, defaultKg: 450, maxSiteMl: 20 },
  { code: "po", name: "Porc", rente: true, defaultKg: 100, maxSiteMl: 5 },
];
export const speciesOf = (c: string) => SPECIES.find((s) => s.code === c);

/** Correspondance espèce du dossier patient → code du formulaire. */
export function speciesFromPatient(species?: string): SpeciesCode | undefined {
  const m: Record<string, SpeciesCode> = { Chien: "ch", Chat: "ca", Lapin: "la", Bovin: "bo", Ovin: "ov", Caprin: "cp", Équidé: "eq", Porcin: "po" };
  return species ? m[species] : undefined;
}

export interface Family {
  code: string;
  name: string;
  note?: string;
}
export const FAMILIES: Family[] = base.familles.map((f) => ({ code: f.code, name: f.nom, note: f.note_alerte ?? undefined }));
export const familyName = (code: string) => FAMILIES.find((f) => f.code === code)?.name ?? code;
export const SOURCES: Record<string, string> = base.sources as Record<string, string>;

export interface Posology {
  id: string;
  ficheId: string;
  species: SpeciesCode;
  /** Libellé du schéma (charge, entretien, forme LA…), précédé de la présentation si besoin. */
  scheme: string;
  min: number;
  max: number;
  unit: string;
  bound: "fourchette" | "plafond" | "minimum";
  route: string;
  frequency: string;
  perDay: number | null;
  conc?: { value: number; unit: string; label: string };
  maxSiteMl?: number;
  alert?: { level: AlertLevel; text: string };
}

export interface FicheText {
  ficheId: string;
  title: string;
  species: SpeciesCode[];
  posologyText: string;
  indications: string;
  contraindications: string;
  withdrawal?: string;
  source: string;
  amm: boolean;
  anecdotal: boolean;
  calculable: boolean;
}

export interface Molecule {
  id: string;
  name: string;
  synonyms: string[];
  family: string;
  species: SpeciesCode[];
  fiches: FicheText[];
  posologies: Posology[];
  added: boolean;
  amm: boolean;
  anecdotal: boolean;
}

export const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const FORM_WORDS = /\b(injectable|pour-on|longue action|la|retard|pate|orale|induction|eau de boisson|comprime|suspension|solution)\b/g;

/** Sépare la DCI et les synonymes : « Emeprid® (métoclopramide) » → métoclopramide + Emeprid®. */
function splitName(raw: string): { dci: string; synonyms: string[]; qualifier: string } {
  const m = raw.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  let dci = raw.trim();
  const synonyms: string[] = [];
  let extra = "";
  if (m) {
    const [, out, inside] = m;
    if (/®/.test(out)) {
      dci = inside.trim();
      synonyms.push(out.trim());
    } else if (/®/.test(inside)) {
      dci = out.trim();
      synonyms.push(inside.trim());
    } else {
      // Parenthèse sans marque déposée : précision de forme ou d'usage (« eau de boisson »), pas un synonyme.
      dci = out.trim();
      extra = inside.trim();
    }
  }
  const key = norm(dci).replace(/®/g, "").replace(/\d+([,.]\d+)?\s*%/g, "").replace(FORM_WORDS, "").replace(/\s+/g, " ").trim();
  const qualifier = [norm(dci) === key ? "" : dci, extra].filter(Boolean).join(" · ");
  return { dci, synonyms, qualifier };
}

const slug = (s: string) =>
  norm(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

interface RawPoso {
  espece: string;
  schema: string;
  dose_min: number;
  dose_max: number;
  unite: string;
  type_borne: string;
  voie: string;
  frequence: string;
  prises_par_jour: number | null;
  conc_defaut_valeur: number | null;
  conc_defaut_unite: string | null;
  conc_defaut_libelle: string | null;
  volume_max_site_ml: number | null;
  alerte_niveau: string | null;
  alerte_texte: string | null;
}

let cache: Molecule[] | null = null;

/** Index construit une fois à partir de la base fournie (285 fiches → ~190 molécules). */
export function baseMolecules(): Molecule[] {
  if (cache) return cache;
  const byKey = new Map<string, Molecule>();
  for (const f of base.fiches) {
    const { dci, synonyms, qualifier } = splitName(f.molecule);
    const key = norm(dci).replace(/®/g, "").replace(/\d+([,.]\d+)?\s*%/g, "").replace(FORM_WORDS, "").replace(/\s+/g, " ").trim();
    const id = slug(key) || slug(dci);
    let mol = byKey.get(id);
    if (!mol) {
      const display = key ? dci.replace(/\d+([,.]\d+)?\s*%/g, "").replace(/\b(injectable|pour-on|longue action|LA|retard)\b/gi, "").replace(/\s+/g, " ").trim() : dci;
      mol = { id, name: display.charAt(0).toUpperCase() + display.slice(1), synonyms: [], family: f.famille_code, species: [], fiches: [], posologies: [], added: false, amm: false, anecdotal: false };
      byKey.set(id, mol);
    }
    for (const s of synonyms) if (!mol.synonyms.includes(s)) mol.synonyms.push(s);
    const sp = f.especes as SpeciesCode[];
    mol.species = Array.from(new Set([...mol.species, ...sp]));
    mol.added ||= f.source === "ajout";
    mol.amm ||= !!f.amm_espece;
    mol.anecdotal ||= !!f.anecdotique;
    mol.fiches.push({
      ficheId: f.id,
      title: f.molecule,
      species: sp,
      posologyText: f.posologie_texte,
      indications: f.indications,
      contraindications: f.contre_indications_effets,
      withdrawal: f.delai_attente ?? undefined,
      source: f.source,
      amm: !!f.amm_espece,
      anecdotal: !!f.anecdotique,
      calculable: f.posologies.length > 0,
    });
    (f.posologies as RawPoso[]).forEach((p, i) => {
      const scheme = [qualifier, p.schema].filter(Boolean).join(" · ");
      mol!.posologies.push({
        id: `${f.id}-${i}`,
        ficheId: f.id,
        species: p.espece as SpeciesCode,
        scheme,
        min: p.dose_min,
        max: p.dose_max,
        unit: p.unite,
        bound: p.type_borne as Posology["bound"],
        route: p.voie,
        frequency: p.frequence,
        perDay: p.prises_par_jour,
        conc: p.conc_defaut_valeur != null && p.conc_defaut_unite ? { value: p.conc_defaut_valeur, unit: p.conc_defaut_unite, label: p.conc_defaut_libelle ?? "" } : undefined,
        maxSiteMl: p.volume_max_site_ml ?? undefined,
        alert: p.alerte_niveau && p.alerte_texte ? { level: (p.alerte_niveau === "warn" ? "warn" : p.alerte_niveau) as AlertLevel, text: p.alerte_texte } : undefined,
      });
    });
  }
  cache = Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name, "fr"));
  return cache;
}

export const INTERACTIONS = base.interactions;
export const REFERENCES = base.references;

/** Texte de recherche sans accents : nom, synonymes, indications, effets. */
export function searchText(m: Molecule, productNames: string[] = []): string {
  return norm([m.name, ...m.synonyms, ...productNames, ...m.fiches.map((f) => `${f.title} ${f.indications} ${f.contraindications}`)].join(" "));
}

export function rangeText(p: Posology) {
  const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 3 });
  return `${p.bound === "plafond" ? "max " : p.bound === "minimum" ? "min " : ""}${p.min === p.max ? fmt(p.min) : `${fmt(p.min)}–${fmt(p.max)}`} ${p.unit}`;
}
