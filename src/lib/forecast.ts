/**
 * Prévisions de commande : consommation récente, tendance des ventes,
 * couverture en jours et quantités suggérées par fournisseur.
 */
import { productStock } from "./calc";
import { addDays } from "./format";
import { receivedForLine } from "./services/suppliersService";
import type { DemoDB, Product } from "./types";

const OUT = new Set(["delivrance", "administration", "mission_sortie"]);

/** Quantité sortie (vendue / consommée) d'un produit entre deux dates incluses. */
export function outflow(db: DemoDB, productId: string, from: string, to: string, est?: string) {
  let q = 0;
  for (const m of db.movements) {
    if (m.productId !== productId || (est && m.establishmentId !== est)) continue;
    const d = m.date.slice(0, 10);
    if (d < from || d > to) continue;
    if (OUT.has(m.type)) q += -m.qty;
    if (m.type === "mission_retour") q -= m.qty;
  }
  return Math.max(0, q);
}

/** Quantités encore attendues sur les commandes envoyées. */
export function onOrder(db: DemoDB, productId: string, est?: string) {
  return db.purchaseOrders
    .filter((p) => ["envoyee", "partiellement_recue"].includes(p.status) && (!est || p.establishmentId === est))
    .flatMap((p) => p.lines.filter((l) => l.productId === productId))
    .reduce((s, l) => s + Math.max(0, l.qtyOrdered - receivedForLine(db, l.id)), 0);
}

export interface ForecastRow {
  product: Product;
  stock: number;
  pending: number;
  q30: number;
  qPrev30: number;
  trend: number; // variation en % (30 j vs 30 j précédents)
  daily: number; // consommation journalière prévue
  coverDays: number | null;
  stockoutDate?: string;
  need: number; // besoin brut sur l'horizon
  suggested: number; // quantité conseillée (arrondie à l'unité d'achat)
  cost: number;
  weekly: number[]; // ventes des 12 dernières semaines
  urgent: boolean;
}

export interface ForecastOptions {
  horizon: number; // jours à couvrir
  leadTime: number; // délai de livraison
  est?: string;
}

export function forecast(db: DemoDB, today: string, o: ForecastOptions): ForecastRow[] {
  const rows: ForecastRow[] = [];
  for (const p of db.products.filter((x) => x.status === "actif")) {
    const q30 = outflow(db, p.id, addDays(today, -29), today, o.est);
    const qPrev30 = outflow(db, p.id, addDays(today, -59), addDays(today, -30), o.est);
    const q90 = outflow(db, p.id, addDays(today, -89), today, o.est);
    const weekly = Array.from({ length: 12 }, (_, i) => outflow(db, p.id, addDays(today, -7 * (12 - i) + 1), addDays(today, -7 * (11 - i)), o.est));
    if (!q90 && !p.alertThreshold) continue;
    const trend = qPrev30 ? (q30 - qPrev30) / qPrev30 : q30 ? 1 : 0;
    // Moyenne pondérée (récent plus fort), corrigée de la moitié de la tendance (bornée).
    const base = 0.6 * (q30 / 30) + 0.4 * (q90 / 90);
    const daily = base * (1 + Math.max(-0.5, Math.min(1, trend)) * 0.5);
    const stock = productStock(db, p.id, o.est, today);
    const pending = onOrder(db, p.id, o.est);
    const need = Math.ceil(daily * (o.horizon + o.leadTime) + p.alertThreshold - stock - pending);
    const unit = Math.max(1, p.conversion || 1);
    const suggested = need > 0 ? Math.ceil(need / unit) * unit : 0;
    const coverDays = daily > 0 ? Math.floor(stock / daily) : null;
    rows.push({
      product: p,
      stock,
      pending,
      q30,
      qPrev30,
      trend: Math.round(trend * 100),
      daily,
      coverDays,
      stockoutDate: coverDays !== null ? addDays(today, coverDays) : undefined,
      need: Math.max(0, need),
      suggested,
      cost: suggested * p.purchasePrice,
      weekly,
      urgent: coverDays !== null && coverDays <= o.leadTime + 3,
    });
  }
  return rows.sort((a, b) => Number(b.urgent) - Number(a.urgent) || (a.coverDays ?? 9999) - (b.coverDays ?? 9999));
}
