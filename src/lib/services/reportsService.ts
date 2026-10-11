/** Sélecteurs de reporting recalculés à partir des données fictives locales. */
import { docTotal, invoiceBalance, isActiveInvoice, isLowStock, lineTotal } from "../calc";
import { addDays, daysBetween } from "../format";
import type { DemoDB, Invoice } from "../types";

export interface Period {
  from: string;
  to: string;
  establishmentId?: string;
}

const inP = (date: string, p: Period) => date.slice(0, 10) >= p.from && date.slice(0, 10) <= p.to;
const inE = (est: string | undefined, p: Period) => !p.establishmentId || est === p.establishmentId;

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export function monthBuckets(n: number, today: string) {
  const [y, m] = today.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(y, m - 1 - (n - 1 - i), 1);
    return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` };
  });
}

/** Chiffre d'affaires net (factures validées − avoirs). */
export function signedRevenue(inv: Invoice) {
  if (!isActiveInvoice(inv)) return 0;
  return inv.kind === "avoir" ? -docTotal(inv.lines) : docTotal(inv.lines);
}

export function revenueSeries(db: DemoDB, months: number, today: string, est?: string) {
  const b = monthBuckets(months, today);
  return {
    labels: b.map((x) => x.label),
    invoiced: b.map((x) => db.invoices.filter((i) => i.date.startsWith(x.key) && (!est || i.establishmentId === est)).reduce((s, i) => s + signedRevenue(i), 0)),
    collected: b.map((x) =>
      db.payments
        .filter((p) => p.date.startsWith(x.key) && (!est || db.accounts.find((a) => a.id === p.accountId)?.establishmentId === est))
        .reduce((s, p) => s + p.amount, 0),
    ),
  };
}

export function consultationSeries(db: DemoDB, granularity: "jour" | "semaine" | "mois", today: string, est?: string) {
  const list = db.consultations.filter((c) => !est || c.establishmentId === est);
  if (granularity === "mois") {
    const b = monthBuckets(6, today);
    return { labels: b.map((x) => x.label), values: b.map((x) => list.filter((c) => c.date.startsWith(x.key)).length) };
  }
  const n = granularity === "jour" ? 14 : 12;
  const step = granularity === "jour" ? 1 : 7;
  const labels: string[] = [];
  const values: number[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const end = addDays(today, -i * step);
    const start = addDays(end, -(step - 1));
    labels.push(granularity === "jour" ? end.slice(8, 10) + "/" + end.slice(5, 7) : `S-${i}`);
    values.push(list.filter((c) => c.date.slice(0, 10) >= start && c.date.slice(0, 10) <= end).length);
  }
  return { labels, values };
}

export function speciesDistribution(db: DemoDB) {
  const map = new Map<string, number>();
  db.patients.filter((p) => p.vitalStatus === "vivant" && !p.archived).forEach((p) => map.set(p.species, (map.get(p.species) ?? 0) + 1));
  db.farms.forEach((f) => f.lots.filter((l) => l.status === "actif").forEach((l) => map.set(`Élevage — ${l.species}`, (map.get(`Élevage — ${l.species}`) ?? 0) + 1)));
  const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  return { labels: entries.map((e) => e[0]), values: entries.map((e) => e[1]) };
}

export function activityByEstablishment(db: DemoDB, p: Period) {
  return db.establishments.map((e) => ({
    id: e.id,
    name: e.name,
    consultations: db.consultations.filter((c) => c.establishmentId === e.id && inP(c.date, p)).length,
    revenue: db.invoices.filter((i) => i.establishmentId === e.id && inP(i.date, p)).reduce((s, i) => s + signedRevenue(i), 0),
    appointments: db.appointments.filter((a) => a.establishmentId === e.id && inP(a.start, p)).length,
    missions: db.missions.filter((m) => m.establishmentId === e.id && inP(m.date, p)).length,
  }));
}

export function expensesByCategory(db: DemoDB, p: Period, includeConfidential: boolean) {
  const map = new Map<string, number>();
  db.expenses
    .filter((e) => e.status === "approuvee" && inP(e.date, p) && (includeConfidential || !e.confidential) && inE(db.accounts.find((a) => a.id === e.accountId)?.establishmentId, p))
    .forEach((e) => map.set(e.category, (map.get(e.category) ?? 0) + e.amount));
  const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  return { labels: entries.map((e) => e[0]), values: entries.map((e) => e[1]) };
}

export function salesMix(db: DemoDB, months: number, today: string) {
  const b = monthBuckets(months, today);
  const sum = (key: string, kind: "service" | "produit") =>
    db.invoices.filter((i) => i.kind === "facture" && isActiveInvoice(i) && i.date.startsWith(key)).reduce((s, i) => s + i.lines.filter((l) => l.kind === kind).reduce((a, l) => a + lineTotal(l), 0), 0);
  return { labels: b.map((x) => x.label), services: b.map((x) => sum(x.key, "service")), products: b.map((x) => sum(x.key, "produit")) };
}

export function periodSummary(db: DemoDB, p: Period, includeConfidential: boolean) {
  const cons = db.consultations.filter((c) => inP(c.date, p) && inE(c.establishmentId, p));
  const appts = db.appointments.filter((a) => inP(a.start, p) && inE(a.establishmentId, p));
  const inv = db.invoices.filter((i) => inP(i.date, p) && inE(i.establishmentId, p));
  const pays = db.payments.filter((x) => inP(x.date, p) && inE(db.accounts.find((a) => a.id === x.accountId)?.establishmentId, p));
  const exps = db.expenses.filter((e) => e.status === "approuvee" && inP(e.date, p) && (includeConfidential || !e.confidential) && inE(db.accounts.find((a) => a.id === e.accountId)?.establishmentId, p));
  const hosp = db.hospitalizations.filter((h) => inP(h.admittedAt, p) && inE(h.establishmentId, p));
  const mis = db.missions.filter((m) => inP(m.date, p) && inE(m.establishmentId, p));
  const revenue = inv.reduce((s, i) => s + signedRevenue(i), 0);
  const expenses = exps.reduce((s, e) => s + e.amount, 0);
  return {
    consultations: cons.length,
    consultationsValidated: cons.filter((c) => c.status === "valide").length,
    patientsSeen: new Set(cons.map((c) => c.patientId)).size,
    appointments: appts.length,
    honored: appts.filter((a) => a.status === "honore").length,
    cancelled: appts.filter((a) => a.status === "annule").length,
    absent: appts.filter((a) => a.status === "absent").length,
    hospitalizations: hosp.length,
    hospDays: hosp.reduce((s, h) => s + Math.max(1, daysBetween(h.admittedAt.slice(0, 10), (h.dischargedAt ?? p.to).slice(0, 10)) + 1), 0),
    missions: mis.length,
    missionsDone: mis.filter((m) => m.status === "terminee").length,
    revenue,
    collected: pays.reduce((s, x) => s + x.amount, 0),
    unpaid: db.invoices.filter((i) => i.kind === "facture" && isActiveInvoice(i) && inE(i.establishmentId, p)).reduce((s, i) => s + Math.max(0, invoiceBalance(db, i)), 0),
    expenses,
    result: revenue - expenses,
  };
}

export function stockAlerts(db: DemoDB, today: string, est?: string) {
  const low = db.products.filter((p) => isLowStock(db, p.id, est, today));
  const horizon = addDays(today, db.settings.expiryAlertDays);
  const expiring = db.lots.filter((l) => l.qtyAvailable > 0 && l.status !== "perime" && l.expiryDate >= today && l.expiryDate <= horizon && (!est || l.establishmentId === est)).sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
  const expired = db.lots.filter((l) => l.qtyAvailable > 0 && (l.status === "perime" || l.expiryDate < today) && (!est || l.establishmentId === est));
  const quarantine = db.lots.filter((l) => l.status === "quarantaine" && l.qtyAvailable > 0 && (!est || l.establishmentId === est));
  return { low, expiring, expired, quarantine };
}

export function userActivity(db: DemoDB, p: Period) {
  return db.users.map((u) => ({
    user: u,
    actions: db.audit.filter((a) => a.userId === u.id && inP(a.date, p)).length,
    consultations: db.consultations.filter((c) => c.vetId === u.id && inP(c.date, p)).length,
    payments: db.payments.filter((x) => x.userId === u.id && inP(x.date, p)).length,
  }));
}
