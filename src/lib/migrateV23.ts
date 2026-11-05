/**
 * Schéma v23 : produits avec voies autorisées et flacon à reconstituer. Ajoute un exemple de
 * spécialité humaine injectable IV (amoxicilline + acide clavulanique 1 g/200 mg) à adapter dans le calculateur.
 */
import type { DemoDB, Product } from "./types";

export function migrateToV23(db: DemoDB): DemoDB {
  if (db.products.some((p) => p.id === "prd-h02")) return { ...db, schemaVersion: 23 };
  const product: Product = {
    id: "prd-h02",
    code: "HUM-002",
    name: "Amoxicilline/acide clavulanique 1 g/200 mg IV (spécialité humaine)",
    category: "medicament",
    description: "Poudre pour solution injectable, usage humain. Exemple de produit à adapter au chien, au chat ou aux bovins avec le calculateur.",
    purchaseUnit: "Boîte de 10 flacons",
    stockUnit: "Flacon",
    saleUnit: "Flacon",
    conversion: 10,
    alertThreshold: 2,
    purchasePrice: 25000,
    salePrice: 0,
    supplierId: db.suppliers[0]?.id ?? "sup-1",
    status: "actif",
    form: "Poudre pour solution injectable",
    activeIngredient: "Amoxicilline + acide clavulanique",
    humanUse: true,
    brandName: "GENCLAV 1 g/200 mg (exemple)",
    composition: [{ moleculeId: "amoxicilline-acide-clavulanique", amount: 1200, unit: "mg" }],
    routes: ["IV"],
    vial: { volumeMl: 20, components: [{ name: "Amoxicilline", mg: 1000 }, { name: "Acide clavulanique", mg: 200 }], note: "Flacon reconstitué : vérifier sur la notice le volume de solvant et le délai d'utilisation (souvent immédiat)." },
    shelf: "humain",
  };
  const est = db.establishments[0];
  const day = db.seededAt.slice(0, 10);
  const exp = `${Number(day.slice(0, 4)) + 2}${day.slice(4)}`;
  const lots = est ? [...db.lots, { id: "lot-h02", ref: "AMC-DEMO-01", productId: product.id, supplierId: product.supplierId, establishmentId: est.id, location: est.locations[0] ?? "Réserve", receivedAt: day, expiryDate: exp, qtyReceived: 10, qtyAvailable: 10, unitCost: 2500, status: "disponible" as const }] : db.lots;
  const movements = est ? [{ id: "mvt-h02", date: `${day}T08:00:00`, productId: product.id, lotId: "lot-h02", establishmentId: est.id, type: "reception" as const, qty: 10, userId: db.users[0].id, note: "Stock initial de démonstration (spécialité humaine IV)", opKey: "seed-h02" }, ...db.movements] : db.movements;
  return { ...db, schemaVersion: 23, products: [...db.products, product], lots, movements };
}
