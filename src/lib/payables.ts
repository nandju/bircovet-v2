/**
 * Dettes fournisseurs et prestataires : reste à payer, échéances, et
 * « remboursement au fil des ventes » (ce que les ventes des articles achetés couvrent déjà).
 */
import { accountBalance } from "./calc";
import { addDays } from "./format";
import type { DemoDB, Supplier, SupplierBill } from "./types";

/** Échéance à partir des conditions de paiement (« 30 jours », « 45 jours fin de mois », « Comptant »). */
export function dueFromTerms(date: string, terms?: string) {
  const t = (terms ?? "").toLowerCase();
  if (/comptant/.test(t)) return date;
  const n = Number(t.match(/(\d+)\s*j/)?.[1] ?? 30);
  let d = addDays(date, n);
  if (/fin de mois/.test(t)) {
    const x = new Date(`${d}T00:00:00`);
    d = new Date(x.getFullYear(), x.getMonth() + 1, 0).toLocaleDateString("sv-SE");
  }
  return d;
}

export const paidOf = (b: SupplierBill) => b.payments.reduce((s, p) => s + p.amount, 0);

/** Quantités vendues / consommées depuis les lots de la réception liée à la facture. */
export function soldQty(db: DemoDB, b: SupplierBill, productId: string) {
  const lotIds = new Set(db.lots.filter((l) => l.productId === productId && (b.receptionId ? l.receptionId === b.receptionId : l.supplierId === b.supplierId && l.receivedAt >= b.date.slice(0, 10))).map((l) => l.id));
  let q = 0;
  for (const m of db.movements) {
    if (!lotIds.has(m.lotId)) continue;
    if (m.type === "delivrance" || m.type === "administration" || m.type === "mission_sortie") q += -m.qty;
    if (m.type === "mission_retour") q -= m.qty;
  }
  return Math.max(0, q);
}

/** Valeur (au coût d'achat) des articles de la facture déjà vendus ou consommés. */
export function coveredBySales(db: DemoDB, b: SupplierBill) {
  if (!b.lines.length) return 0;
  return Math.round(b.lines.reduce((s, l) => s + Math.min(l.qty, soldQty(db, b, l.productId)) * l.unitCost, 0));
}

export interface BillState {
  bill: SupplierBill;
  supplier?: Supplier;
  /** Montant réellement dû aujourd'hui (pour un dépôt-vente : uniquement ce qui est vendu). */
  owed: number;
  paid: number;
  remaining: number;
  covered: number;
  coveredPct: number;
  /** Montant que les ventes permettent de payer maintenant. */
  payableNow: number;
  overdue: boolean;
  daysToDue: number;
}

export function billState(db: DemoDB, b: SupplierBill, today: string): BillState {
  const paid = paidOf(b);
  const covered = coveredBySales(db, b);
  const owed = b.kind === "depot_vente" ? covered : b.amount;
  const remaining = Math.max(0, owed - paid);
  const payableNow = b.kind === "prestation" ? remaining : Math.max(0, Math.min(b.amount, covered) - paid);
  const days = Math.round((new Date(`${b.dueDate}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000);
  return {
    bill: b,
    supplier: db.suppliers.find((s) => s.id === b.supplierId),
    owed,
    paid,
    remaining,
    covered,
    coveredPct: b.amount ? Math.min(100, Math.round((covered / b.amount) * 100)) : 0,
    payableNow,
    overdue: remaining > 0 && b.kind !== "depot_vente" && days < 0,
    daysToDue: days,
  };
}

export const openBills = (db: DemoDB, today: string) => (db.bills ?? []).filter((b) => b.status !== "annulee").map((b) => billState(db, b, today)).filter((s) => s.remaining > 0 || (s.bill.kind === "depot_vente" && s.bill.status === "ouverte"));

export interface SupplierDebt {
  supplier: Supplier;
  remaining: number;
  overdue: number;
  dueSoon: number;
  payableNow: number;
  bills: number;
  nextDue?: string;
}

/** Synthèse par fournisseur / prestataire. */
export function debtsBySupplier(db: DemoDB, today: string, horizon = 7): SupplierDebt[] {
  const map = new Map<string, SupplierDebt>();
  for (const s of openBills(db, today)) {
    if (!s.supplier) continue;
    const e = map.get(s.supplier.id) ?? { supplier: s.supplier, remaining: 0, overdue: 0, dueSoon: 0, payableNow: 0, bills: 0 };
    e.remaining += s.remaining;
    if (s.overdue) e.overdue += s.remaining;
    else if (s.daysToDue <= horizon && s.bill.kind !== "depot_vente") e.dueSoon += s.remaining;
    e.payableNow += Math.min(s.payableNow, s.remaining);
    e.bills += 1;
    if (s.remaining > 0 && (!e.nextDue || s.bill.dueDate < e.nextDue)) e.nextDue = s.bill.dueDate;
    map.set(s.supplier.id, e);
  }
  return [...map.values()].sort((a, b) => b.overdue - a.overdue || b.remaining - a.remaining);
}

/** Indicateurs pour le tableau de bord. */
export function payablesSummary(db: DemoDB, today: string, est?: string) {
  const all = openBills(db, today);
  const cash = db.accounts.filter((a) => !est || a.establishmentId === est).reduce((s, a) => s + accountBalance(db, a.id), 0);
  const sum = (f: (s: BillState) => number) => all.reduce((n, s) => n + f(s), 0);
  const due7 = sum((s) => (!s.overdue && s.bill.kind !== "depot_vente" && s.daysToDue <= 7 ? s.remaining : 0));
  const due30 = sum((s) => (!s.overdue && s.bill.kind !== "depot_vente" && s.daysToDue <= 30 ? s.remaining : 0));
  const overdue = sum((s) => (s.overdue ? s.remaining : 0));
  return {
    total: sum((s) => s.remaining),
    overdue,
    overdueCount: all.filter((s) => s.overdue).length,
    due7,
    due30,
    payableNow: sum((s) => Math.min(s.payableNow, s.remaining)),
    consignment: sum((s) => (s.bill.kind === "depot_vente" ? s.remaining : 0)),
    cash,
    /** Trésorerie restante après paiement de l'échu et des 7 prochains jours. */
    afterDue: cash - overdue - due7,
    suppliers: debtsBySupplier(db, today),
  };
}

/**
 * Plan de règlement suggéré : d'abord l'échu, puis ce que les ventes couvrent,
 * puis les échéances proches, dans la limite d'un budget (trésorerie disponible).
 */
export function paymentPlan(db: DemoDB, today: string, budget: number) {
  const rows = openBills(db, today)
    .map((s) => {
      const reason = s.overdue ? "Échue" : s.payableNow > 0 && s.bill.kind !== "prestation" ? "Couverte par les ventes" : s.daysToDue <= 7 ? "Échéance proche" : "À venir";
      const want = s.overdue || s.bill.kind === "prestation" ? s.remaining : s.daysToDue <= 7 ? s.remaining : Math.min(s.payableNow, s.remaining);
      const prio = s.overdue ? 0 : reason === "Couverte par les ventes" ? 1 : reason === "Échéance proche" ? 2 : 3;
      return { s, reason, want, prio };
    })
    .filter((r) => r.want > 0)
    .sort((a, b) => a.prio - b.prio || a.s.bill.dueDate.localeCompare(b.s.bill.dueDate));
  let left = Math.max(0, budget);
  return rows.map((r) => {
    const pay = Math.min(r.want, left);
    left -= pay;
    return { ...r, pay };
  });
}
