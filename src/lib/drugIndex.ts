/**
 * Index thérapeutique de la clinique : lecture d'un tableau (Excel ou CSV) en lignes
 * molécule · indication · posologie · voie · AMM, recherche et légende des abréviations.
 */
import type { DemoDB, DrugIndexEntry, DrugIndexState } from "./types";

export const INDEX_SPECIES = ["Cheval", "Chien", "Chat", "Bovin", "Ovin", "Caprin", "Porcin", "Volaille", "Lapin", "Poisson", "Autre"];

export const ABBREVIATIONS: { group: string; items: [string, string][] }[] = [
  { group: "Rythme", items: [["SID", "1 fois par jour"], ["BID", "2 fois par jour"], ["TID", "3 fois par jour"], ["QID", "4 fois par jour"], ["q4-6 h", "toutes les 4 à 6 heures"], ["q2 j", "tous les 2 jours"]] },
  { group: "Voie", items: [["IV", "intraveineuse"], ["IM", "intramusculaire"], ["SC", "sous-cutanée"], ["PO", "voie orale"], ["IR", "intrarectale"], ["Sous-conj.", "sous-conjonctivale"], ["Ophtalmo.", "voie locale oculaire"]] },
  { group: "Classe", items: [["AINS", "anti-inflammatoire non stéroïdien"], ["AIS", "anti-inflammatoire stéroïdien"], ["Anti-H1 / H2", "antihistaminique H1 / H2"], ["IPP", "inhibiteur des pompes à protons"]] },
];

export const indexOf = (db: DemoDB): DrugIndexState => db.drugIndex ?? { entries: [], sources: [] };

export const normText = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** Lecture d'un CSV (séparateur ; , ou tabulation, guillemets gérés). */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const first = clean.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const sep = [";", "\t", ","].map((c) => [c, first.split(c).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows;
}

type Field = "molecule" | "indication" | "dosage" | "route" | "amm" | "note" | "species";
const HEADERS: [Field, RegExp][] = [
  ["molecule", /^(molecule|principe actif|dci|substance)/],
  ["indication", /^indication/],
  ["dosage", /^(posologie|dose|dosage)/],
  ["route", /^(voie|route)/],
  ["amm", /^amm/],
  ["species", /^(espece|especes|animal)/],
  ["note", /^(note|remarque|commentaire|observation)/],
];

export interface ParsedIndex {
  headerRow: number;
  columns: Partial<Record<Field, number>>;
  entries: Omit<DrugIndexEntry, "id" | "updatedAt" | "updatedById" | "sourceId">[];
  skipped: number;
}

/** Repère la ligne d'en-tête (celle qui contient « Molécule ») et transforme les lignes suivantes. */
export function rowsToEntries(rows: string[][], species: string): ParsedIndex | null {
  const headerRow = rows.findIndex((r) => r.some((c) => /^(molecule|principe actif|dci)/.test(normText(c ?? ""))));
  if (headerRow < 0) return null;
  const columns: Partial<Record<Field, number>> = {};
  rows[headerRow].forEach((c, i) => {
    const h = normText(c ?? "");
    for (const [field, re] of HEADERS) if (columns[field] === undefined && re.test(h)) columns[field] = i;
  });
  const at = (r: string[], f: Field) => (columns[f] !== undefined ? (r[columns[f]!] ?? "").replace(/\s+/g, " ").trim() : "");
  const entries: ParsedIndex["entries"] = [];
  let skipped = 0;
  let lastMolecule = "";
  for (const r of rows.slice(headerRow + 1)) {
    if (!r.some((c) => c?.trim())) continue;
    // Cellules fusionnées : une molécule vide reprend la précédente.
    const molecule = at(r, "molecule") || lastMolecule;
    const dosage = at(r, "dosage");
    const indication = at(r, "indication");
    if (!molecule || (!dosage && !indication && !at(r, "route"))) {
      skipped++;
      continue;
    }
    lastMolecule = molecule;
    entries.push({ species: at(r, "species") || species, molecule, indication: indication || undefined, dosage: dosage || undefined, route: at(r, "route") || undefined, amm: at(r, "amm") || undefined, note: at(r, "note") || undefined });
  }
  return { headerRow, columns, entries, skipped };
}

/** Lignes de l'index pour une molécule (nom ou début de nom, sans accents). */
export function entriesForMolecule(db: DemoDB, name: string, species?: string): DrugIndexEntry[] {
  const key = normText(name).split(/[\s(]/)[0];
  if (key.length < 4) return [];
  return indexOf(db).entries.filter((e) => normText(e.molecule).startsWith(key) && (!species || e.species === species));
}
