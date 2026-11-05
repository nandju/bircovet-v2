/**
 * Pont entre l'Index thérapeutique de la clinique (texte importé) et le calculateur :
 * une posologie écrite « 1,1 mg/kg SID » devient une fourchette calculable.
 */
import { entriesForMolecule, indexOf, normText } from "../drugIndex";
import type { DemoDB, DrugIndexEntry } from "../types";
import type { Molecule, Posology, SpeciesCode } from "./model";

const CODE: Record<string, SpeciesCode> = { cheval: "eq", equide: "eq", equides: "eq", chien: "ch", chat: "ca", bovin: "bo", ovin: "ov", caprin: "cp", porcin: "po", porc: "po", lapin: "la" };
export const speciesCodeOf = (name: string): SpeciesCode | undefined => CODE[normText(name)];
const NAME: Record<SpeciesCode, string> = { eq: "Cheval", ch: "Chien", ca: "Chat", bo: "Bovin", ov: "Ovin", cp: "Caprin", po: "Porcin", la: "Lapin" };
export const indexSpeciesName = (c: SpeciesCode) => NAME[c];

const PER_DAY: Record<string, number> = { sid: 1, bid: 2, tid: 3, qid: 4 };
const numFr = (s: string) => Number(s.replace(/\s/g, "").replace(",", "."));

export interface ParsedDose {
  min: number;
  max: number;
  unit: string;
  frequency: string;
  perDay: number | null;
}

/** Lit la première dose par kilo d'un texte : « 0,02-0,06 mg/kg », « 10 000-50 000 UI/kg QID », « 2,5 µg/kg ». */
export function parseDosage(text?: string): ParsedDose | null {
  if (!text) return null;
  const m = text.match(/(\d[\d\s]*(?:[.,]\d+)?)\s*(?:(?:-|–|à)\s*(\d[\d\s]*(?:[.,]\d+)?))?\s*(mg|µg|μg|g|UI|mL)\s*\/\s*kg/i);
  if (!m) return null;
  const min = numFr(m[1]);
  const max = m[2] ? numFr(m[2]) : min;
  if (!(min > 0) || !(max >= min)) return null;
  const unit = `${m[3].replace("μ", "µ").replace(/^ui$/i, "UI").replace(/^ml$/i, "mL")}/kg`;
  const f = text.match(/\b(SID|BID|TID|QID)\b|\bq\s?(\d+(?:-\d+)?)\s?(h|j)\b/i);
  const frequency = f ? (f[1] ? f[1].toUpperCase() : `toutes les ${f[2]} ${f[3] === "h" ? "h" : "j"}`) : "dose unique ou selon l'index";
  const perDay = f?.[1] ? PER_DAY[f[1].toLowerCase()] : f?.[3] === "h" ? Math.round(24 / Number(f[2].split("-")[0])) : null;
  return { min, max, unit, frequency, perDay };
}

/** Posologie calculable tirée d'une ligne de l'index (ou null si le texte n'a pas de dose par kilo). */
export function entryPosology(e: DrugIndexEntry, sp: SpeciesCode): Posology | null {
  const d = parseDosage(e.dosage);
  if (!d) return null;
  return {
    id: `idx-${e.id}`,
    ficheId: e.id,
    species: sp,
    scheme: `Index de la clinique${e.indication ? ` · ${e.indication}` : ""}`,
    min: d.min,
    max: d.max,
    unit: d.unit,
    bound: "fourchette",
    route: e.route ?? "voie à préciser",
    frequency: d.frequency,
    perDay: d.perDay,
    alert: { level: "info", text: `Recommandation de l'index de la clinique : « ${e.dosage} »${e.amm ? ` · AMM ${e.amm.toLowerCase()}` : ""}. Vérifier sur une référence à jour.` },
  };
}

/** Posologies de l'index pour une molécule du formulaire, par espèce. */
export function indexPosologies(db: DemoDB, m: Molecule): Posology[] {
  const out: Posology[] = [];
  for (const e of entriesForMolecule(db, m.name)) {
    const sp = speciesCodeOf(e.species);
    const p = sp && entryPosology(e, sp);
    if (p) out.push(p);
  }
  return out;
}

const slug = (s: string) => normText(s).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** Molécules présentes seulement dans l'index de la clinique (absentes du formulaire). */
export function indexOnlyMolecules(db: DemoDB, known: Molecule[]): Molecule[] {
  const byName = new Map<string, DrugIndexEntry[]>();
  for (const e of indexOf(db).entries) {
    const k = normText(e.molecule);
    byName.set(k, [...(byName.get(k) ?? []), e]);
  }
  const out: Molecule[] = [];
  for (const [k, list] of byName) {
    const first = k.split(/[\s(]/)[0];
    if (known.some((m) => normText(m.name).startsWith(first) && first.length >= 4)) continue;
    const posologies = list.map((e) => { const sp = speciesCodeOf(e.species); return sp ? entryPosology(e, sp) : null; }).filter((p): p is Posology => !!p);
    const species = Array.from(new Set(list.map((e) => speciesCodeOf(e.species)).filter((x): x is SpeciesCode => !!x)));
    out.push({ id: `idx-${slug(list[0].molecule)}`, name: list[0].molecule, synonyms: [], family: "autre", species, posologies, added: true, amm: false, anecdotal: false, fiches: [] });
  }
  return out;
}

/** Concentration (mg/mL) d'un flacon reconstitué, pour un composant ou pour l'association entière. */
export function vialConc(vial: { volumeMl: number; components: { name: string; mg: number }[] }, basis: string): number {
  if (!(vial.volumeMl > 0)) return NaN;
  const comp = vial.components.find((c) => c.name === basis);
  const mg = comp ? comp.mg : vial.components.reduce((s, c) => s + (c.mg || 0), 0);
  return mg / vial.volumeMl;
}

/** Les voies du produit couvrent-elles la voie recommandée ? */
export function routeMismatch(recommended: string, productRoutes?: string[]): boolean {
  if (!productRoutes?.length) return false;
  const norm = (s: string) => normText(s).replace(/[^a-z]/g, " ");
  const rec = norm(recommended).split(/\s+/).filter((t) => ["iv", "im", "sc", "po", "ir", "topique", "inhalation"].includes(t));
  if (!rec.length) return false;
  const prod = productRoutes.flatMap((r) => norm(r).split(/\s+/));
  return !rec.some((t) => prod.includes(t));
}
