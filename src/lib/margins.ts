/**
 * Marges sur ventes et prestations : chiffre d'affaires, coût d'achat des produits
 * vendus ou consommés pour l'acte, marge et taux de marge, par nature.
 */
import { isActiveInvoice, lineTotal } from "./calc";
import type { RevenueBucket } from "./daily";
import type { DemoDB } from "./types";

export interface Period {
  from: string;
  to: string;
}
const inP = (d: string, p: Period) => d.slice(0, 10) >= p.from && d.slice(0, 10) <= p.to;
const cost = (db: DemoDB, productId: string | undefined, qty: number) => qty * (db.products.find((x) => x.id === productId)?.purchasePrice ?? 0);

export interface MarginLine {
  revenue: number;
  cost: number;
  margin: number;
  rate: number | null;
}
const mk = (revenue: number, c: number): MarginLine => ({ revenue, cost: Math.round(c), margin: Math.round(revenue - c), rate: revenue ? Math.round(((revenue - c) / revenue) * 1000) / 10 : null });

/** Coût des produits consommés pour un acte (soins, hospitalisation, mission). */
function actCost(db: DemoDB, kind: string, id: string) {
  let c = 0;
  for (const m of db.movements) {
    if (m.ref?.kind !== kind || m.ref.id !== id) continue;
    if (m.type === "administration") c += cost(db, m.productId, -m.qty);
  }
  if (kind === "mission") {
    const ms = db.missions.find((x) => x.id === id);
    for (const s of ms?.stock ?? []) c += cost(db, s.productId, s.consumed + s.lost);
  }
  return c;
}

export function margins(db: DemoDB, p: Period, est?: string) {
  const acc: Record<RevenueBucket, { r: number; c: number }> = { pharmacie: { r: 0, c: 0 }, consultation: { r: 0, c: 0 }, hospitalisation: { r: 0, c: 0 }, terrain: { r: 0, c: 0 }, autre: { r: 0, c: 0 } };
  const byProduct = new Map<string, { qty: number; r: number; c: number }>();
  const seenActs = new Set<string>();
  const invoices = db.invoices.filter((i) => i.kind === "facture" && isActiveInvoice(i) && inP(i.date, p) && (!est || i.establishmentId === est));
  for (const inv of invoices) {
    for (const l of inv.lines) {
      const r = lineTotal(l);
      if (l.kind === "produit" || inv.channel === "comptoir") {
        const c = cost(db, l.productId, l.qty);
        acc.pharmacie.r += r;
        acc.pharmacie.c += c;
        if (l.productId) {
          const e = byProduct.get(l.productId) ?? { qty: 0, r: 0, c: 0 };
          e.qty += l.qty;
          e.r += r;
          e.c += c;
          byProduct.set(l.productId, e);
        }
        continue;
      }
      const k = l.source?.kind;
      const b: RevenueBucket = k === "hospitalisation" ? "hospitalisation" : k === "mission" ? "terrain" : k === "formation" ? "autre" : "consultation";
      acc[b].r += r;
      const key = `${k}:${l.source?.id}`;
      if (l.source && !seenActs.has(key)) {
        seenActs.add(key);
        acc[b].c += actCost(db, k ?? "autre", l.source.id);
      }
    }
  }
  const buckets = Object.fromEntries((Object.keys(acc) as RevenueBucket[]).map((k) => [k, mk(acc[k].r, acc[k].c)])) as Record<RevenueBucket, MarginLine>;
  const services = mk(acc.consultation.r + acc.hospitalisation.r + acc.terrain.r + acc.autre.r, acc.consultation.c + acc.hospitalisation.c + acc.terrain.c + acc.autre.c);
  const total = mk(services.revenue + buckets.pharmacie.revenue, services.cost + buckets.pharmacie.cost);
  const products = [...byProduct.entries()].map(([id, e]) => ({ id, name: db.products.find((x) => x.id === id)?.name ?? id, qty: e.qty, ...mk(e.r, e.c) })).sort((a, b) => b.margin - a.margin);
  return { buckets, services, total, products, count: invoices.length };
}

/** Raccourcis de période pour les filtres (jour, veille, mois, année). */
export function periodOf(kind: "jour" | "veille" | "mois" | "annee", today: string, value?: string): Period {
  if (kind === "jour") return { from: today, to: today };
  if (kind === "veille") {
    const d = new Date(`${today}T00:00:00`);
    d.setDate(d.getDate() - 1);
    const y = d.toLocaleDateString("sv-SE");
    return { from: y, to: y };
  }
  if (kind === "mois") {
    const m = value ?? today.slice(0, 7);
    const last = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate();
    return { from: `${m}-01`, to: `${m}-${String(last).padStart(2, "0")}` };
  }
  const y = value ?? today.slice(0, 4);
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}
