/**
 * Analyse des recettes par famille : chaque ligne facturée a une « source »
 * (type d'acte ou catégorie de produit) ; le DG regroupe les sources en familles.
 */
import { clienteleOf } from "./revenueHelpers";
import { isActiveInvoice, lineTotal } from "./calc";
import { labelOf, optionsOf } from "./labels";
import type { Period } from "./margins";
import type { DemoDB, Invoice, InvoiceLine, RevenueFamily } from "./types";

export const SERVICE_SOURCES: { key: string; label: string; re?: RegExp }[] = [
  { key: "svc:vaccination", label: "Actes de vaccination", re: /vaccin/i },
  { key: "svc:chirurgie", label: "Chirurgie et stérilisation", re: /chirurg|st[ée]rilis|castr|ovariect|op[ée]ration|c[ée]sarienne|suture|d[ée]tartr/i },
  { key: "svc:examens", label: "Examens, laboratoire, imagerie", re: /examen|analyse|labo|bilan|radio|[ée]cho|imagerie|autopsie|test/i },
  { key: "svc:identification", label: "Identification et certificats", re: /puce|tatou|identif|passeport|certificat/i },
  { key: "svc:domicile", label: "Visites à domicile", re: /domicile|d[ée]placement/i },
  { key: "svc:soins", label: "Soins, pansements, injections", re: /soin|pansement|injection|perfusion|toilett/i },
  { key: "svc:consultation", label: "Consultations" },
  { key: "svc:hospitalisation", label: "Hospitalisation" },
  { key: "svc:terrain", label: "Missions et visites d'élevage" },
  { key: "svc:formation", label: "Formations" },
];

/** Toutes les sources possibles (actes + catégories de produits actuelles). */
export function allSources(): { key: string; label: string; kind: "service" | "produit" }[] {
  return [...SERVICE_SOURCES.map((s) => ({ key: s.key, label: s.label, kind: "service" as const })), ...optionsOf("category").map((o) => ({ key: `prod:${o.value}`, label: `Produits · ${o.label}`, kind: "produit" as const }))];
}

export function sourceLabel(key: string) {
  if (key.startsWith("prod:")) return `Produits · ${labelOf("category", key.slice(5))}`;
  return SERVICE_SOURCES.find((s) => s.key === key)?.label ?? key;
}

/** Source d'une ligne de facture. */
export function sourceOf(db: DemoDB, inv: Invoice, l: InvoiceLine): string {
  if (l.kind === "produit" || inv.channel === "comptoir") {
    const p = l.productId ? db.products.find((x) => x.id === l.productId) : undefined;
    return `prod:${p?.category ?? "medicament"}`;
  }
  const k = l.source?.kind;
  if (k === "hospitalisation") return "svc:hospitalisation";
  if (k === "mission") return "svc:terrain";
  if (k === "formation") return "svc:formation";
  for (const s of SERVICE_SOURCES) if (s.re?.test(l.label)) return s.key;
  return "svc:consultation";
}

export const FAMILY_COLORS: Record<string, { dot: string; bar: string }> = {
  brand: { dot: "bg-brand-500", bar: "bg-brand-500" },
  blue: { dot: "bg-blue-light-500", bar: "bg-blue-light-500" },
  orange: { dot: "bg-orange-500", bar: "bg-orange-500" },
  purple: { dot: "bg-theme-purple-500", bar: "bg-theme-purple-500" },
  pink: { dot: "bg-theme-pink-500", bar: "bg-theme-pink-500" },
  success: { dot: "bg-success-500", bar: "bg-success-500" },
  warning: { dot: "bg-warning-500", bar: "bg-warning-500" },
  error: { dot: "bg-error-500", bar: "bg-error-500" },
  gray: { dot: "bg-gray-400", bar: "bg-gray-400" },
};

export const DEFAULT_FAMILIES: RevenueFamily[] = [
  { id: "fam-consult", name: "Consultations et soins", color: "brand", keys: ["svc:consultation", "svc:soins", "svc:domicile"] },
  { id: "fam-vacc", name: "Vaccination", color: "blue", keys: ["svc:vaccination", "prod:vaccin"] },
  { id: "fam-chir", name: "Chirurgie", color: "purple", keys: ["svc:chirurgie"] },
  { id: "fam-exam", name: "Examens et laboratoire", color: "pink", keys: ["svc:examens", "svc:identification"] },
  { id: "fam-hosp", name: "Hospitalisation", color: "warning", keys: ["svc:hospitalisation"] },
  { id: "fam-pharma", name: "Pharmacie (médicaments)", color: "success", keys: ["prod:medicament", "prod:antiparasitaire", "prod:consommable", "prod:materiel"] },
  { id: "fam-alim", name: "Aliments et accessoires", color: "orange", keys: ["prod:aliment"] },
  { id: "fam-rente", name: "Élevages et terrain", color: "error", keys: ["svc:terrain"] },
  { id: "fam-form", name: "Formations", color: "gray", keys: ["svc:formation"] },
];

export const UNCLASSIFIED = "__non_classe";
export type Clientele = "tous" | "compagnie" | "rente";

export interface FamilyRow {
  id: string;
  name: string;
  color: string;
  revenue: number;
  cost: number;
  margin: number;
  rate: number | null;
  count: number;
  share: number;
  prev: number;
  growth: number | null;
  target?: number;
  bySource: { key: string; revenue: number }[];
  top: { label: string; revenue: number }[];
}

const productCost = (db: DemoDB, l: InvoiceLine) => (l.productId ? l.qty * (db.products.find((p) => p.id === l.productId)?.purchasePrice ?? 0) : 0);
const inP = (d: string, p: Period) => d.slice(0, 10) >= p.from && d.slice(0, 10) <= p.to;

const daysBetweenIso = (a: string, b: string) => Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86400000);
const shift = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00`);
  x.setDate(x.getDate() + n);
  return x.toLocaleDateString("sv-SE");
};

/** Période précédente de même longueur. */
export function previousPeriod(p: Period): Period {
  const f = new Date(`${p.from}T00:00:00`);
  const t = new Date(`${p.to}T00:00:00`);
  const days = Math.round((t.getTime() - f.getTime()) / 86400000) + 1;
  const pt = new Date(f);
  pt.setDate(pt.getDate() - 1);
  const pf = new Date(pt);
  pf.setDate(pf.getDate() - days + 1);
  return { from: pf.toLocaleDateString("sv-SE"), to: pt.toLocaleDateString("sv-SE") };
}

/** Recettes facturées par famille sur la période, avec comparaison à la période précédente. */
export function revenueByFamily(db: DemoDB, period: Period, opts: { est?: string; clientele?: Clientele; today?: string } = {}) {
  const families = db.settings.revenueFamilies?.length ? db.settings.revenueFamilies : DEFAULT_FAMILIES;
  const famOf = new Map<string, string>();
  for (const f of families) for (const k of f.keys) if (!famOf.has(k)) famOf.set(k, f.id);
  // Période en cours : on compare à durée égale (ex. 1er–3 novembre vs 1er–3 octobre).
  const partial = !!opts.today && period.from <= opts.today && period.to > opts.today;
  const p: Period = partial ? { from: period.from, to: opts.today! } : period;
  const fullPrev = previousPeriod(period);
  const prevP: Period = partial ? { from: fullPrev.from, to: shift(fullPrev.from, daysBetweenIso(p.from, p.to)) } : fullPrev;
  type Acc = { r: number; c: number; n: Set<string>; prev: number; src: Map<string, number>; items: Map<string, number> };
  const acc = new Map<string, Acc>();
  const get = (id: string) => {
    let a = acc.get(id);
    if (!a) acc.set(id, (a = { r: 0, c: 0, n: new Set(), prev: 0, src: new Map(), items: new Map() }));
    return a;
  };
  for (const inv of db.invoices) {
    if (inv.kind !== "facture" || !isActiveInvoice(inv) || (opts.est && inv.establishmentId !== opts.est)) continue;
    const cur = inP(inv.date, p);
    const prev = inP(inv.date, prevP);
    if (!cur && !prev) continue;
    for (const l of inv.lines) {
      if (opts.clientele && opts.clientele !== "tous" && clienteleOf(db, inv, l) !== opts.clientele) continue;
      const key = sourceOf(db, inv, l);
      const a = get(famOf.get(key) ?? UNCLASSIFIED);
      const v = lineTotal(l);
      if (prev) {
        a.prev += v;
        continue;
      }
      a.r += v;
      a.c += productCost(db, l);
      a.n.add(inv.id);
      a.src.set(key, (a.src.get(key) ?? 0) + v);
      const name = l.label.replace(/\s*\(démo\)/i, "");
      a.items.set(name, (a.items.get(name) ?? 0) + v);
    }
  }
  const total = [...acc.values()].reduce((s, a) => s + a.r, 0);
  const prevTotal = [...acc.values()].reduce((s, a) => s + a.prev, 0);
  const months = Math.max(1, Math.round((daysBetweenIso(period.from, period.to) + 1) / 30.4));
  const rows: FamilyRow[] = [...families.map((f) => ({ id: f.id, name: f.name, color: f.color, target: f.monthlyTarget ? f.monthlyTarget * months : undefined })), { id: UNCLASSIFIED, name: "Non classé", color: "gray", target: undefined }]
    .map((f) => {
      const a = acc.get(f.id);
      const r = a?.r ?? 0;
      const c = a?.c ?? 0;
      return {
        ...f,
        revenue: r,
        cost: Math.round(c),
        margin: Math.round(r - c),
        rate: r ? Math.round(((r - c) / r) * 1000) / 10 : null,
        count: a?.n.size ?? 0,
        share: total ? Math.round((r / total) * 1000) / 10 : 0,
        prev: a?.prev ?? 0,
        growth: a?.prev ? Math.round(((r - a.prev) / a.prev) * 1000) / 10 : null,
        bySource: [...(a?.src ?? new Map()).entries()].map(([key, revenue]) => ({ key, revenue })).sort((x, y) => y.revenue - x.revenue),
        top: [...(a?.items ?? new Map()).entries()].map(([label, revenue]) => ({ label, revenue })).sort((x, y) => y.revenue - x.revenue).slice(0, 3),
      };
    })
    .filter((r) => r.id !== UNCLASSIFIED || r.revenue > 0 || r.prev > 0)
    .sort((x, y) => y.revenue - x.revenue);
  return { rows, total, prevTotal, growth: prevTotal ? Math.round(((total - prevTotal) / prevTotal) * 1000) / 10 : null, prevPeriod: prevP, partial };
}

/** Évolution mensuelle (6 derniers mois) d'une famille. */
export function familyTrend(db: DemoDB, familyId: string, today: string, opts: { est?: string; clientele?: Clientele } = {}, n = 6) {
  const out: { month: string; revenue: number }[] = [];
  const d = new Date(`${today.slice(0, 7)}-01T00:00:00`);
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const from = m.toLocaleDateString("sv-SE");
    const to = new Date(m.getFullYear(), m.getMonth() + 1, 0).toLocaleDateString("sv-SE");
    const r = revenueByFamily(db, { from, to }, opts).rows.find((x) => x.id === familyId)?.revenue ?? 0;
    out.push({ month: from.slice(0, 7), revenue: r });
  }
  return out;
}

export interface Insight {
  level: "push" | "watch" | "fix";
  familyId: string;
  title: string;
  text: string;
}

/** Pistes d'action simples, tirées des chiffres. */
export function insights(rows: FamilyRow[]): Insight[] {
  const out: Insight[] = [];
  const real = rows.filter((r) => r.id !== UNCLASSIFIED && (r.revenue > 0 || r.prev > 0));
  const avgRate = (() => {
    const r = real.reduce((s, x) => s + x.revenue, 0);
    const m = real.reduce((s, x) => s + x.margin, 0);
    return r ? (m / r) * 100 : 0;
  })();
  for (const r of real) {
    const solid = r.prev >= 10000 || r.revenue >= 10000;
    if (solid && r.growth !== null && r.growth >= 20 && r.revenue > 0)
      out.push({ level: "push", familyId: r.id, title: `${r.name} : en forte hausse (+${r.growth} %)`, text: "La demande est là : assurez le stock et la disponibilité, et communiquez dessus (WhatsApp, réseaux) pour accélérer." });
    if (solid && r.growth !== null && r.growth <= -15)
      out.push({ level: "watch", familyId: r.id, title: `${r.name} : en baisse (${r.growth} %)`, text: "Relancez les clients concernés (rappels, SMS), vérifiez les prix et la concurrence, et proposez une offre ciblée." });
    if (r.rate !== null && r.rate >= Math.max(50, avgRate) && r.share > 0 && r.share < 15)
      out.push({ level: "push", familyId: r.id, title: `${r.name} : très rentable mais peu vendu`, text: `Marge de ${r.rate} % pour seulement ${r.share} % des recettes : c'est le levier à pousser (mise en avant au comptoir, conseil systématique en consultation).` });
    if (r.rate !== null && r.rate < 25 && r.share >= 15)
      out.push({ level: "fix", familyId: r.id, title: `${r.name} : beaucoup de ventes, peu de marge`, text: `Seulement ${r.rate} % de marge sur ${r.share} % des recettes : renégociez avec les fournisseurs ou revoyez les prix de vente.` });
    if (r.target && r.revenue < r.target * 0.8)
      out.push({ level: "watch", familyId: r.id, title: `${r.name} : objectif non atteint`, text: `Réalisé ${Math.round((r.revenue / r.target) * 100)} % de l'objectif sur la période.` });
  }
  const top = real[0];
  if (top && top.share >= 50) out.push({ level: "watch", familyId: top.id, title: `Dépendance à « ${top.name} »`, text: `${top.share} % des recettes viennent d'une seule famille : développez une deuxième source pour sécuriser la clinique.` });
  const unc = rows.find((r) => r.id === UNCLASSIFIED);
  if (unc && unc.revenue > 0) out.push({ level: "fix", familyId: UNCLASSIFIED, title: "Des recettes non classées", text: "Rattachez ces sources à une famille dans « Familles de recettes » pour une analyse complète." });
  const order = { push: 0, watch: 1, fix: 2 };
  return out.sort((a, b) => order[a.level] - order[b.level]).slice(0, 7);
}
