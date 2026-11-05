/**
 * Couche « clinique » de l'Index des molécules : statuts de validation, fiches créées
 * localement, lien avec les produits du stock et migration des données de démonstration.
 */
import type { DemoDB, DraftMolecule, MoleculeStatus, PharmaState, Product } from "../types";
import { baseMolecules, type Molecule, type Posology, type SpeciesCode } from "./model";

export const STATUS_LABELS: Record<MoleculeStatus, string> = {
  brouillon: "Brouillon",
  a_valider: "À valider",
  valide: "Validée",
  retire: "Retirée",
};

export function pharmaOf(db: DemoDB): PharmaState {
  return db.pharma ?? { states: {}, drafts: [], calcLog: [], referentIds: [] };
}

export function statusOf(db: DemoDB, id: string): MoleculeStatus {
  const st = pharmaOf(db).states[id]?.status;
  if (st) return st;
  return pharmaOf(db).drafts.some((d) => d.id === id) ? "brouillon" : "a_valider";
}

export function draftToMolecule(d: DraftMolecule): Molecule {
  const posologies: Posology[] = d.posologies.map((p) => ({
    id: p.id,
    ficheId: d.id,
    species: p.species as SpeciesCode,
    scheme: p.scheme,
    min: p.min,
    max: p.max,
    unit: p.unit,
    bound: p.bound,
    route: p.route,
    frequency: p.frequency,
    perDay: p.perDay,
    conc: p.concValue && p.concUnit ? { value: p.concValue, unit: p.concUnit, label: "" } : undefined,
    alert: p.alertText ? { level: "warn", text: p.alertText } : undefined,
  }));
  const species = Array.from(new Set(posologies.map((p) => p.species)));
  return {
    id: d.id,
    name: d.name,
    synonyms: d.synonyms,
    family: d.family,
    species,
    posologies,
    added: true,
    amm: false,
    anecdotal: false,
    fiches: [
      {
        ficheId: d.id,
        title: d.name,
        species,
        posologyText: posologies.map((p) => `${p.species} : ${p.min}–${p.max} ${p.unit} ${p.route} ${p.frequency}`).join(" · "),
        indications: d.indications,
        contraindications: d.contraindications,
        source: "clinique",
        amm: false,
        anecdotal: false,
        calculable: posologies.length > 0,
      },
    ],
  };
}

/** Toutes les molécules : base fournie + fiches créées par la clinique. */
export function allMolecules(db: DemoDB): Molecule[] {
  const drafts = pharmaOf(db).drafts.map(draftToMolecule);
  return [...baseMolecules(), ...drafts].sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export function findMolecule(db: DemoDB, id: string): Molecule | undefined {
  return allMolecules(db).find((m) => m.id === id);
}

export const productsWith = (db: DemoDB, moleculeId: string): Product[] => db.products.filter((p) => p.composition?.some((c) => c.moleculeId === moleculeId));

export const isHumanProduct = (p?: Product) => !!p?.humanUse;

/* ---------------- Migration v7 → v8 ---------------- */

type Enrich = Partial<Product>;
const DEMO_LINKS: Record<string, Enrich> = {
  "prd-01": { composition: [{ moleculeId: "amoxicilline", amount: 250, unit: "mg" }], concentration: { value: 250, unit: "mg/comprimé" }, brandName: "Amoxi-démo 250", laboratory: "Laboratoire fictif", shelf: "atb-compagnie" },
  "prd-02": { composition: [{ moleculeId: "meloxicam", amount: 1.5, unit: "mg/mL" }], concentration: { value: 1.5, unit: "mg/mL" }, brandName: "Mélox-démo 1,5 mg/mL", laboratory: "Laboratoire fictif", shelf: "ains" },
  "prd-04": { composition: [{ moleculeId: "oxytetracycline", amount: 200, unit: "mg/mL" }], concentration: { value: 200, unit: "mg/mL" }, brandName: "Oxy-LA démo 20 %", withdrawalMeatDays: 28, withdrawalMilkDays: 7, shelf: "atb-rente" },
  "prd-13": { composition: [{ moleculeId: "ivermectine", amount: 10, unit: "mg/mL" }], concentration: { value: 1, unit: "%" }, brandName: "Iverm-démo 1 %", withdrawalMeatDays: 35, shelf: "apr-rente" },
  "prd-12": { shelf: "apr-chien" },
  "prd-11": { shelf: "apr-chien" },
  "prd-06": { shelf: "vac-chien" },
  "prd-07": { shelf: "vac-chien" },
  "prd-08": { shelf: "vac-chat" },
  "prd-09": { shelf: "vac-volaille" },
  "prd-10": { shelf: "vac-volaille" },
  "prd-18": { shelf: "ali-chien" },
  "prd-19": { shelf: "ali-chat" },
  "prd-20": { shelf: "ali-volaille" },
  "prd-21": { shelf: "acc-compagnie" },
};

export function migrateToV8(db: DemoDB): DemoDB {
  const products = db.products.map((p) => ({ ...p }));
  // Les champs déjà renseignés par l'utilisateur priment ; on ajoute seulement les liens manquants.
  for (const p of products) {
    const e = DEMO_LINKS[p.id];
    if (!e) continue;
    for (const [k, v] of Object.entries(e)) if ((p as unknown as Record<string, unknown>)[k] === undefined) (p as unknown as Record<string, unknown>)[k] = v;
  }
  if (!products.some((p) => p.id === "prd-h01")) {
    products.push({
      id: "prd-h01",
      code: "HUM-001",
      name: "Paracétamol 500 mg (spécialité humaine)",
      category: "medicament",
      description: "Médicament humain parfois utilisé hors AMM. Mortel chez le chat.",
      purchaseUnit: "Boîte de 16",
      stockUnit: "Comprimé",
      saleUnit: "Comprimé",
      conversion: 16,
      alertThreshold: 0,
      purchasePrice: 800,
      salePrice: 0,
      supplierId: "sup-1",
      status: "actif",
      form: "Comprimé",
      activeIngredient: "Paracétamol",
      humanUse: true,
      composition: [{ moleculeId: "paracetamol", amount: 500, unit: "mg" }],
      concentration: { value: 500, unit: "mg/comprimé" },
      brandName: "Doliprane® (exemple)",
      shelf: "humain",
    });
  }
  const suppliers = db.suppliers.map((s) =>
    s.id === "sup-1" && !s.ncc
      ? { ...s, ncc: "1234567 A (fictif)", rccm: "CI-ABJ-2019-B-00000 (fictif)", location: "Marcory Zone 4, rue du Canal", gps: "5.2990, -3.9980", intermediaries: [{ id: "int-1", name: "M. Yao Serge", role: "Délégué commercial", company: "VetoPharma", phone: "+225 07 00 00 00 01" }, { id: "int-2", name: "Mme Diallo Awa", role: "Service livraison", phone: "+225 05 00 00 00 02", email: "livraison@vetopharma.demo" }] }
      : s,
  );
  const lots = [...db.lots];
  const movements = [...db.movements];
  if (!lots.some((l) => l.productId === "prd-h01")) {
    const est = db.establishments[0];
    const day = db.seededAt.slice(0, 10);
    const exp = `${Number(day.slice(0, 4)) + 2}${day.slice(4)}`;
    lots.push({ id: "lot-h01", ref: "PARA-DEMO-01", productId: "prd-h01", supplierId: "sup-1", establishmentId: est.id, location: est.locations[0] ?? "Réserve", receivedAt: day, expiryDate: exp, qtyReceived: 32, qtyAvailable: 32, unitCost: 50, status: "disponible" });
    movements.unshift({ id: "mvt-h01", date: `${day}T08:00:00`, productId: "prd-h01", lotId: "lot-h01", establishmentId: est.id, type: "reception", qty: 32, userId: db.users[0].id, note: "Stock initial de démonstration (spécialité humaine)", opKey: "seed-h01" });
  }
  const referentIds = db.users.filter((u) => u.roleId === "dg" || u.roleId === "vet").map((u) => u.id).slice(0, 2);
  return { ...db, schemaVersion: 8, products, suppliers, lots, movements, pharma: db.pharma ?? { states: {}, drafts: [], calcLog: [], referentIds } };
}
