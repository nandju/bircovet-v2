/** Budgets : consommation par ligne (dépenses et commandes imputées). */
import type { Budget, BudgetLine, DemoDB } from "./types";

export const BUDGET_STATUS: Record<Budget["status"], { label: string; chip: string }> = {
  brouillon: { label: "Brouillon", chip: "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300" },
  soumis: { label: "Soumis au DG", chip: "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-300" },
  valide: { label: "Validé", chip: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-300" },
  refuse: { label: "Refusé", chip: "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-300" },
};

export const STOCK_CATEGORY = "Achats de stock";

export const poTotal = (po: { lines: { qtyOrdered: number; unitPrice: number }[] }) => po.lines.reduce((s, l) => s + l.qtyOrdered * l.unitPrice, 0);

/** Montant engagé sur une ligne : dépenses (hors rejetées) + commandes (hors brouillons et annulées). */
export function lineUsage(db: DemoDB, line: BudgetLine, excludePoId?: string) {
  const exp = db.expenses.filter((e) => e.budgetLineId === line.id && e.status !== "rejetee").reduce((s, e) => s + e.amount, 0);
  const po = db.purchaseOrders.filter((p) => p.budgetLineId === line.id && p.id !== excludePoId && !["brouillon", "annulee"].includes(p.status)).reduce((s, p) => s + poTotal(p), 0);
  return { expenses: exp, orders: po, used: exp + po, left: line.amount - exp - po };
}

export const budgetTotal = (b: Budget) => b.lines.reduce((s, l) => s + l.amount, 0);

export function budgetUsage(db: DemoDB, b: Budget) {
  const used = b.lines.reduce((s, l) => s + lineUsage(db, l).used, 0);
  const total = budgetTotal(b);
  return { total, used, left: total - used, pct: total ? Math.round((used / total) * 100) : 0 };
}

/** Lignes de budget validé utilisables pour une date (mois) donnée. */
export function activeLines(db: DemoDB, date: string, establishmentId?: string) {
  const month = date.slice(0, 7);
  return (db.budgets ?? [])
    .filter((b) => b.status === "valide" && b.period === month && (!establishmentId || b.establishmentId === establishmentId))
    .flatMap((b) => b.lines.map((l) => ({ budget: b, line: l, ...lineUsage(db, l) })));
}

export function findLine(db: DemoDB, lineId?: string) {
  if (!lineId) return undefined;
  for (const b of db.budgets ?? []) {
    const l = b.lines.find((x) => x.id === lineId);
    if (l) return { budget: b, line: l };
  }
  return undefined;
}

/** Une commande peut-elle partir sans aval du DG ? */
export function poBudgetCheck(db: DemoDB, po: { id: string; budgetLineId?: string; lines: { qtyOrdered: number; unitPrice: number }[] }) {
  const total = poTotal(po);
  const f = findLine(db, po.budgetLineId);
  if (!f) return { ok: false, total, reason: "Aucune ligne de budget validé n'est imputée." };
  if (f.budget.status !== "valide") return { ok: false, total, reason: "Le budget imputé n'est pas encore validé." };
  const u = lineUsage(db, f.line, po.id);
  if (total > u.left) return { ok: false, total, left: u.left, reason: `Dépassement : ${total.toLocaleString("fr-FR")} FCFA pour ${Math.max(0, u.left).toLocaleString("fr-FR")} FCFA restants sur « ${f.line.label} ».` };
  return { ok: true, total, left: u.left, reason: "" };
}

export const approvedFor = (db: DemoDB, refId: string) => (db.approvals ?? []).some((a) => a.refId === refId && a.status === "approuvee");
