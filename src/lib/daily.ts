/**
 * Chiffres du jour : valeur du stock sorti (J et J-1), ventes comptoir, recette (encaissements)
 * ventilée entre pharmacie et actes (consultation, hospitalisation, mission / visite…).
 */
import { docTotal, lineTotal } from "./calc";
import { addDays } from "./format";
import type { DemoDB, Invoice, MovementType } from "./types";

export const OUT_LABELS: Partial<Record<MovementType, string>> = {
  delivrance: "Ventes et délivrances",
  administration: "Soins administrés",
  mission_sortie: "Sorties en mission",
  perte: "Pertes et péremptions",
  retour_fournisseur: "Retours fournisseur",
  correction: "Corrections",
  inventaire: "Écarts d'inventaire",
};

/** Sorties de stock d'un jour (hors transferts entre sites), valorisées au prix d'achat et de vente. */
export function stockOut(db: DemoDB, day: string, est?: string) {
  const mv = db.movements.filter((m) => m.qty < 0 && m.date.slice(0, 10) === day && m.type !== "transfert_sortie" && (!est || m.establishmentId === est));
  const byType = new Map<string, { qty: number; cost: number; sale: number }>();
  const byProduct = new Map<string, { qty: number; cost: number; sale: number }>();
  let cost = 0;
  let sale = 0;
  for (const m of mv) {
    const p = db.products.find((x) => x.id === m.productId);
    const q = -m.qty;
    const c = q * (p?.purchasePrice ?? 0);
    const s = q * (p?.salePrice ?? 0);
    cost += c;
    sale += s;
    for (const [map, key] of [[byType, m.type], [byProduct, m.productId]] as const) {
      const e = map.get(key) ?? { qty: 0, cost: 0, sale: 0 };
      e.qty += q;
      e.cost += c;
      e.sale += s;
      map.set(key, e);
    }
  }
  return {
    count: mv.length,
    cost,
    sale,
    byType: [...byType.entries()].map(([k, v]) => ({ type: k, label: OUT_LABELS[k as MovementType] ?? k, ...v })).sort((a, b) => b.cost - a.cost),
    top: [...byProduct.entries()].map(([k, v]) => ({ name: db.products.find((p) => p.id === k)?.name ?? k, ...v })).sort((a, b) => b.cost - a.cost).slice(0, 8),
  };
}

export const counterSalesOn = (db: DemoDB, day: string, est?: string) =>
  db.invoices.filter((i) => i.channel === "comptoir" && i.status !== "annulee" && i.date.slice(0, 10) === day && (!est || i.establishmentId === est)).sort((a, b) => (b.validatedAt ?? b.date).localeCompare(a.validatedAt ?? a.date));

export type RevenueBucket = "pharmacie" | "consultation" | "hospitalisation" | "terrain" | "autre";
export const BUCKET_META: Record<RevenueBucket, { label: string; dot: string; bar: string }> = {
  pharmacie: { label: "Pharmacie (produits)", dot: "bg-tertiary-500", bar: "bg-linear-to-r from-tertiary-600 to-tertiary-400" },
  consultation: { label: "Consultations et actes", dot: "bg-brand-500", bar: "bg-linear-to-r from-brand-600 to-brand-400" },
  hospitalisation: { label: "Hospitalisation", dot: "bg-theme-purple-500", bar: "bg-linear-to-r from-theme-purple-500 to-theme-pink-500" },
  terrain: { label: "Missions et visites de ferme", dot: "bg-orange-500", bar: "bg-linear-to-r from-orange-600 to-orange-400" },
  autre: { label: "Autres (formations…)", dot: "bg-gray-400", bar: "bg-gray-400" },
};

/** Répartition d'une facture par nature : produits → pharmacie ; services selon leur origine. */
function splitInvoice(inv: Invoice): Record<RevenueBucket, number> {
  const out: Record<RevenueBucket, number> = { pharmacie: 0, consultation: 0, hospitalisation: 0, terrain: 0, autre: 0 };
  for (const l of inv.lines) {
    const v = lineTotal(l);
    if (l.kind === "produit" || inv.channel === "comptoir") out.pharmacie += v;
    else if (l.source?.kind === "hospitalisation") out.hospitalisation += v;
    else if (l.source?.kind === "mission") out.terrain += v;
    else if (l.source?.kind === "formation") out.autre += v;
    else out.consultation += v;
  }
  return out;
}

/** Recette d'un jour = encaissements, ventilés au prorata des factures réglées. */
export function receiptsOn(db: DemoDB, day: string, est?: string) {
  const pays = db.payments.filter((p) => p.date.slice(0, 10) === day && (!est || db.accounts.find((a) => a.id === p.accountId)?.establishmentId === est));
  const buckets: Record<RevenueBucket, number> = { pharmacie: 0, consultation: 0, hospitalisation: 0, terrain: 0, autre: 0 };
  const methods = new Map<string, number>();
  let total = 0;
  for (const p of pays) {
    total += p.amount;
    methods.set(p.method, (methods.get(p.method) ?? 0) + p.amount);
    let allocated = 0;
    for (const a of p.allocations) {
      const inv = a.invoiceId ? db.invoices.find((i) => i.id === a.invoiceId) : undefined;
      if (!inv) continue;
      const split = splitInvoice(inv);
      const tot = docTotal(inv.lines) || 1;
      for (const k of Object.keys(split) as RevenueBucket[]) buckets[k] += (a.amount * split[k]) / tot;
      allocated += a.amount;
    }
    buckets.autre += Math.max(0, p.amount - allocated); // acomptes, anciennes créances
  }
  for (const k of Object.keys(buckets) as RevenueBucket[]) buckets[k] = Math.round(buckets[k]);
  return { total, count: pays.length, buckets, methods: [...methods.entries()].sort((a, b) => b[1] - a[1]) };
}

export const yesterdayOf = (today: string) => addDays(today, -1);
