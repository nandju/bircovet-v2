/**
 * Indicateurs des rapports de réunion, par catégorie.
 * Tout est recalculé à partir des données locales sur la période choisie.
 */
import { docTotal, invoiceBalance, isActiveInvoice, lineTotal, productStock } from "./calc";
import { activitiesOf, type Activity } from "./clientActivity";
import { RENTE_SPECIES } from "./followup";
import { daysBetween } from "./format";
import { ruralTypeOf } from "./rural";
import { stockAlerts } from "./services/reportsService";
import { farmHerd, farmScale, speciesOf } from "./farmProfile";
import { findMolecule } from "./pharma/state";
import { courseEnd, courseStats } from "./treatments";
import type { DemoDB, Invoice } from "./types";

export interface RPeriod {
  from: string;
  to: string;
}
const inP = (d: string | undefined, p: RPeriod) => !!d && d.slice(0, 10) >= p.from && d.slice(0, 10) <= p.to;
const count = <T,>(arr: T[], key: (x: T) => string) => {
  const m = new Map<string, number>();
  for (const x of arr) m.set(key(x), (m.get(key(x)) ?? 0) + 1);
  return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
};

/** Répartition du chiffre d'affaires d'une facture par activité. */
export function revenueByActivity(inv: Invoice): Record<Activity, number> {
  const out: Record<Activity, number> = { compagnie: 0, rente: 0, pharmacie: 0 };
  const sign = inv.kind === "avoir" ? -1 : 1;
  if (inv.channel === "comptoir") {
    out.pharmacie += sign * docTotal(inv.lines);
    return out;
  }
  for (const l of inv.lines) out[l.source?.kind === "mission" ? "rente" : "compagnie"] += sign * lineTotal(l);
  return out;
}

export function pharmacyReport(db: DemoDB, p: RPeriod, est?: string) {
  const sales = db.invoices.filter((i) => i.channel === "comptoir" && i.status !== "annulee" && inP(i.date, p) && (!est || i.establishmentId === est));
  const total = sales.reduce((s, i) => s + docTotal(i.lines), 0);
  const byProduct = new Map<string, { qty: number; amount: number }>();
  for (const s of sales) for (const l of s.lines) if (l.productId) {
    const x = byProduct.get(l.productId) ?? { qty: 0, amount: 0 };
    x.qty += l.qty;
    x.amount += lineTotal(l);
    byProduct.set(l.productId, x);
  }
  const top = Array.from(byProduct.entries()).sort((a, b) => b[1].amount - a[1].amount).slice(0, 10).map(([id, v]) => ({ name: db.products.find((x) => x.id === id)?.name ?? id, ...v }));
  const newClients = db.clients.filter((c) => c.acquisition === "Comptoir pharmacie" && inP(c.createdAt, p));
  const herdsCaptured = db.farms.filter((f) => inP(f.createdAt, p) && newClients.some((c) => c.id === f.clientId));
  const alerts = stockAlerts(db, p.to, est);
  return {
    sales: sales.length,
    total,
    basket: sales.length ? Math.round(total / sales.length) : 0,
    walkIn: sales.filter((s) => s.clientId === "cli-passage").length,
    top,
    bySpecies: count(sales.filter((s) => s.saleInfo?.species), (s) => s.saleInfo!.species!),
    byPurpose: count(sales.filter((s) => s.saleInfo?.purpose), (s) => s.saleInfo!.purpose!.toLowerCase()).slice(0, 8),
    newClients: newClients.length,
    herdsCaptured: herdsCaptured.length,
    lowStock: alerts.low.map((x) => ({ name: x.name, stock: productStock(db, x.id, est, p.to), threshold: x.alertThreshold })),
    expiring: alerts.expiring.length,
    expired: alerts.expired.length,
  };
}

export function clientsReport(db: DemoDB, p: RPeriod) {
  const clients = db.clients.filter((c) => c.status === "actif" && !c.isWalkIn);
  const created = clients.filter((c) => inP(c.createdAt, p));
  const touches = (db.followUps ?? []).flatMap((pl) => pl.touches.map((t) => ({ pl, t })));
  const done = touches.filter((x) => x.t.status === "fait" && inP(x.t.doneAt, p));
  const late = touches.filter((x) => x.pl.status === "actif" && x.t.status === "a_faire" && x.t.dueDate < p.to);
  const reached = done.filter((x) => x.t.outcome !== "injoignable");
  const needs = done.filter((x) => x.t.outcome === "besoin" || x.t.outcome === "a_revoir");
  const prospects = db.prospects ?? [];
  const actBy = (a: Activity) => clients.filter((c) => activitiesOf(db, c).includes(a)).length;
  return {
    total: clients.length,
    created: created.length,
    compagnie: actBy("compagnie"),
    rente: actBy("rente"),
    pharmacie: actBy("pharmacie"),
    both: clients.filter((c) => { const a = activitiesOf(db, c); return a.includes("compagnie") && a.includes("rente"); }).length,
    touchesDone: done.length,
    reachRate: done.length ? Math.round((reached.length / done.length) * 100) : 0,
    touchesLate: late.length,
    needs: needs.map((x) => ({ client: db.clients.find((c) => c.id === x.pl.clientId)?.name ?? "", label: x.pl.label, note: x.t.note ?? "", outcome: x.t.outcome })),
    prospectsOpen: prospects.filter((x) => !["gagne", "perdu"].includes(x.stage)).length,
    prospectsWon: prospects.filter((x) => x.stage === "gagne" && inP(x.updatedAt, p)).length,
    prospectsLost: prospects.filter((x) => x.stage === "perdu" && inP(x.updatedAt, p)).map((x) => ({ name: x.name, reason: x.lostReason ?? "" })),
  };
}

export function clinicReport(db: DemoDB, p: RPeriod, est?: string) {
  const isPet = (patientId: string) => !RENTE_SPECIES.includes(db.patients.find((x) => x.id === patientId)?.species ?? "");
  const cons = db.consultations.filter((c) => inP(c.date, p) && (!est || c.establishmentId === est) && isPet(c.patientId));
  const appts = db.appointments.filter((a) => inP(a.start, p) && (!est || a.establishmentId === est));
  const hosp = db.hospitalizations.filter((h) => inP(h.admittedAt, p) && (!est || h.establishmentId === est));
  return {
    consultations: cons.length,
    validated: cons.filter((c) => c.status === "valide").length,
    patients: new Set(cons.map((c) => c.patientId)).size,
    bySpecies: count(cons, (c) => db.patients.find((x) => x.id === c.patientId)?.species ?? "?"),
    byReason: count(cons, (c) => c.reason.toLowerCase()).slice(0, 8),
    appointments: appts.length,
    honored: appts.filter((a) => a.status === "honore").length,
    absent: appts.filter((a) => a.status === "absent").length,
    hospitalizations: hosp.length,
    deaths: db.patients.filter((x) => x.vitalStatus === "decede" && inP(x.deathDate, p)).length,
  };
}

export function ruralReport(db: DemoDB, p: RPeriod, est?: string) {
  const mis = db.missions.filter((m) => inP(m.date, p) && (!est || m.establishmentId === est) && m.status !== "annulee");
  const by = (t: string) => mis.filter((m) => ruralTypeOf(m) === t);
  const farmsActive = db.farms.filter((f) => f.status === "actif");
  const headTotal = farmsActive.reduce((s, f) => s + f.lots.filter((l) => l.status === "actif").reduce((t, l) => t + ([...f.headcounts].filter((h) => h.lotId === l.id).sort((a, b) => b.date.localeCompare(a.date))[0]?.count ?? 0), 0), 0);
  return {
    visits: by("visite").length,
    emergencies: by("urgence").length,
    missions: by("mission").length,
    reportsMissing: mis.filter((m) => m.status === "terminee" && !m.report.trim()).length,
    farms: farmsActive.length,
    heads: headTotal,
    list: mis.map((m) => ({ code: m.code, type: ruralTypeOf(m), date: m.date, farm: db.farms.find((f) => f.id === m.farmIds[0])?.name ?? m.location, objective: m.objective, status: m.status })),
    ...ruralSynthesis(db, p, mis),
  };
}

const clean = (s: string) => s.toLowerCase().split(/[.;\n]/)[0].replace(/\s+/g, " ").trim().slice(0, 60);

/** Synthèse rurale : visites, animaux vus par espèce, régions, problèmes, molécules, catégories d'éleveurs. */
function ruralSynthesis(db: DemoDB, p: RPeriod, mis: DemoDB["missions"]) {
  const visitMissions = mis.filter((m) => ruralTypeOf(m) === "visite");
  const farmVisits = db.farms.flatMap((f) => f.visits.filter((v) => inP(v.date, p) && !v.missionId).map((v) => ({ f, v })));
  const visitedFarmIds = new Set([...visitMissions.flatMap((m) => m.farmIds), ...farmVisits.map((x) => x.f.id)]);
  // Animaux vus (effectifs observés en visite) et animaux traités (interventions), par espèce.
  const seen = new Map<string, { seen: number; treated: number; interventions: number }>();
  const add = (sp: string, k: "seen" | "treated" | "interventions", n: number) => {
    const e = seen.get(sp) ?? { seen: 0, treated: 0, interventions: 0 };
    e[k] += n;
    seen.set(sp, e);
  };
  for (const m of mis)
    for (const o of m.observedHeadcounts) {
      const f = db.farms.find((x) => x.id === o.farmId);
      const lot = f?.lots.find((l) => l.name === o.lotLabel);
      const herd = f ? farmHerd(f) : [];
      add(lot ? speciesOf(lot.species) : herd.length === 1 ? herd[0].species : speciesOf(o.lotLabel), "seen", o.count);
    }
  const interventions = db.farms.flatMap((f) => (f.interventions ?? []).filter((x) => inP(x.date, p)).map((x) => ({ f, x })));
  for (const { x } of interventions) {
    add(speciesOf(x.species), "treated", x.count);
    add(speciesOf(x.species), "interventions", 1);
  }
  // Régions visitées.
  const regions = new Map<string, { visits: number; farms: Set<string> }>();
  for (const m of mis) {
    const fs = m.farmIds.map((id) => db.farms.find((f) => f.id === id)).filter(Boolean) as DemoDB["farms"];
    const reg = fs[0]?.region ?? m.location;
    const e = regions.get(reg) ?? { visits: 0, farms: new Set<string>() };
    e.visits += 1;
    fs.forEach((f) => e.farms.add(f.id));
    regions.set(reg, e);
  }
  // Problèmes les plus fréquents.
  const problems: string[] = [];
  for (const { x } of interventions) if (x.problem) problems.push(clean(x.problem));
  for (const m of mis) {
    if (m.emergency?.reason) problems.push(clean(m.emergency.reason));
    const dx = m.reportSections?.diagnostic || m.reportSections?.examen;
    if (dx) problems.push(clean(dx));
  }
  for (const i of db.invoices) if (i.channel === "comptoir" && inP(i.date, p) && i.saleInfo?.purpose && i.saleInfo.species && i.saleInfo.species !== "Chien" && i.saleInfo.species !== "Chat") problems.push(clean(i.saleInfo.purpose));
  // Catégories d'éleveurs.
  const scales = { petit: 0, moyen: 0, gros: 0 };
  for (const f of db.farms.filter((x) => x.status === "actif")) scales[farmScale(db, f, p.to).scale] += 1;
  const renteRevenue = db.invoices.filter((i) => isActiveInvoice(i) && inP(i.date, p)).reduce((s, i) => s + revenueByActivity(i).rente, 0);
  return {
    farmVisits: visitMissions.length + farmVisits.length,
    farmsVisited: visitedFarmIds.size,
    animals: [...seen.entries()].sort((a, b) => b[1].seen + b[1].treated - (a[1].seen + a[1].treated)),
    animalsTreated: [...seen.values()].reduce((s, e) => s + e.treated, 0),
    regions: [...regions.entries()].map(([r, e]) => ({ region: r, visits: e.visits, farms: e.farms.size })).sort((a, b) => b.visits - a.visits),
    problems: count(problems.filter(Boolean), (x) => x).slice(0, 10),
    molecules: moleculeDemand(db, p, "rente").slice(0, 12),
    scales,
    renteRevenue,
  };
}

/** Molécules demandées sur la période (ventes, factures, missions, interventions). */
export function moleculeDemand(db: DemoDB, p: RPeriod, scope: "all" | "rente" = "all") {
  const m = new Map<string, { qty: number; times: number; sources: Set<string> }>();
  const bump = (name: string, qty: number, src: string) => {
    const k = name.trim();
    if (!k) return;
    const e = m.get(k) ?? { qty: 0, times: 0, sources: new Set<string>() };
    e.qty += qty;
    e.times += 1;
    e.sources.add(src);
    m.set(k, e);
  };
  const namesOf = (productId: string) => {
    const pr = db.products.find((x) => x.id === productId);
    if (!pr) return [];
    const mols = (pr.composition ?? []).map((c) => findMolecule(db, c.moleculeId)?.name).filter(Boolean) as string[];
    return mols.length ? mols : [pr.activeIngredient || pr.name];
  };
  const isRenteInv = (i: Invoice) => (i.saleInfo?.species ? !["Chien", "Chat"].includes(i.saleInfo.species) : i.lines.some((l) => l.source?.kind === "mission")) || ((cl) => !!cl && activitiesOf(db, cl).includes("rente"))(db.clients.find((c) => c.id === i.clientId));
  for (const i of db.invoices) {
    if (i.kind !== "facture" || i.status === "annulee" || !inP(i.date, p)) continue;
    if (scope === "rente" && !isRenteInv(i)) continue;
    for (const l of i.lines) if (l.productId) for (const n of namesOf(l.productId)) bump(n, l.qty, i.channel === "comptoir" ? "comptoir" : "facture");
  }
  for (const ms of db.missions) {
    if (!inP(ms.date, p) || ms.status === "annulee") continue;
    for (const s of ms.stock) for (const n of namesOf(s.productId)) if (s.consumed + s.delivered > 0) bump(n, s.consumed + s.delivered, "mission");
  }
  for (const f of db.farms) for (const x of f.interventions ?? []) if (inP(x.date, p)) {
    const names = x.productId ? namesOf(x.productId) : x.product ? [x.product] : [];
    for (const n of names) bump(n, 1, "intervention");
  }
  if (scope === "all") for (const rx of db.prescriptions) if (inP(rx.date, p)) for (const n of namesOf(rx.productId)) bump(n, rx.quantity, "ordonnance");
  return [...m.entries()].map(([name, e]) => ({ name, qty: e.qty, times: e.times, sources: [...e.sources].join(", ") })).sort((a, b) => b.times - a.times || b.qty - a.qty);
}

/** Observance des traitements suivis sur la période. */
export function treatmentsReport(db: DemoDB, p: RPeriod) {
  const list = (db.treatments ?? []).filter((c) => c.startDate <= p.to && courseEnd(c) >= p.from);
  const now = `${p.to}T23:59`;
  const agg = (xs: typeof list) => {
    const st = xs.map((c) => courseStats(c, now));
    const due = st.reduce((s, x) => s + x.due, 0);
    const given = st.reduce((s, x) => s + x.given, 0);
    return { n: xs.length, due, given, rate: due ? Math.round((given / due) * 100) : null };
  };
  const byUser = new Map<string, number>();
  for (const c of list) for (const d of c.doses) if (d.by === "equipe" && d.status === "donne" && inP(d.day, p)) byUser.set(d.userId, (byUser.get(d.userId) ?? 0) + 1);
  const trends = count(list.map((c) => courseStats(c, now).trend?.trend ?? "sans_avis"), (x) => x);
  return { clinic: agg(list.filter((c) => c.setting === "hospitalisation")), home: agg(list.filter((c) => c.setting === "domicile")), byUser: [...byUser.entries()].map(([u, n]) => ({ user: db.users.find((x) => x.id === u)?.name ?? u, n })).sort((a, b) => b.n - a.n), trends };
}

export interface ActionRow {
  kind: string;
  label: string;
  who: string;
  due?: string;
  late: boolean;
}
export function actionsReport(db: DemoDB, today: string): ActionRow[] {
  const name = (id?: string) => db.users.find((u) => u.id === id)?.name ?? "Non assigné";
  const rows: ActionRow[] = [];
  for (const t of db.tasks.filter((x) => x.status !== "termine")) rows.push({ kind: "Tâche", label: t.title, who: name(t.assigneeId), due: t.dueDate, late: t.dueDate < today });
  for (const m of db.missions) for (const a of m.actionItems.filter((x) => !x.done)) rows.push({ kind: "Élevage", label: `${a.label} (${m.code})`, who: name(a.assigneeId ?? m.leaderId), due: a.dueDate, late: !!a.dueDate && a.dueDate < today });
  for (const pl of (db.followUps ?? []).filter((x) => x.status === "actif")) {
    const t = pl.touches.find((x) => x.status === "a_faire");
    if (t && t.dueDate <= today) rows.push({ kind: "Relance", label: `${t.stage} · ${db.clients.find((c) => c.id === pl.clientId)?.name ?? ""} — ${pl.label}`, who: name(pl.ownerId), due: t.dueDate, late: t.dueDate < today });
  }
  for (const pr of (db.prospects ?? []).filter((x) => !["gagne", "perdu"].includes(x.stage) && x.nextActionDate && x.nextActionDate <= today)) rows.push({ kind: "Prospect", label: `${pr.name} — ${pr.nextAction}`, who: name(pr.ownerId), due: pr.nextActionDate, late: pr.nextActionDate! < today });
  return rows.sort((a, b) => a.who.localeCompare(b.who) || (a.due ?? "9").localeCompare(b.due ?? "9"));
}

export function financeReport(db: DemoDB, p: RPeriod, includeConfidential: boolean, est?: string) {
  const inv = db.invoices.filter((i) => (i.kind === "facture" || i.kind === "avoir") && isActiveInvoice(i) && inP(i.date, p) && (!est || i.establishmentId === est));
  const split: Record<Activity, number> = { compagnie: 0, rente: 0, pharmacie: 0 };
  for (const i of inv) {
    const r = revenueByActivity(i);
    (Object.keys(r) as Activity[]).forEach((k) => (split[k] += r[k]));
  }
  const revenue = split.compagnie + split.rente + split.pharmacie;
  const accEst = (id: string) => db.accounts.find((a) => a.id === id)?.establishmentId;
  const collected = db.payments.filter((x) => inP(x.date, p) && (!est || accEst(x.accountId) === est)).reduce((s, x) => s + x.amount, 0);
  const exps = db.expenses.filter((e) => e.status === "approuvee" && inP(e.date, p) && (includeConfidential || !e.confidential) && (!est || accEst(e.accountId) === est));
  const expenses = exps.reduce((s, e) => s + e.amount, 0);
  const open = db.invoices.filter((i) => i.kind === "facture" && isActiveInvoice(i) && invoiceBalance(db, i) > 0 && (!est || i.establishmentId === est));
  const aging = { "0–30 j": 0, "31–60 j": 0, "61–90 j": 0, "> 90 j": 0 } as Record<string, number>;
  for (const i of open) {
    const d = daysBetween(i.dueDate, p.to);
    aging[d <= 30 ? "0–30 j" : d <= 60 ? "31–60 j" : d <= 90 ? "61–90 j" : "> 90 j"] += invoiceBalance(db, i);
  }
  return { revenue, split, collected, expenses, result: revenue - expenses, unpaid: open.reduce((s, i) => s + invoiceBalance(db, i), 0), aging, byCategory: Array.from(new Set(exps.map((e) => e.category))).map((k) => [k, exps.filter((e) => e.category === k).reduce((s, e) => s + e.amount, 0)] as [string, number]).sort((a, b) => b[1] - a[1]) };
}

export function referrersReport(db: DemoDB, p: RPeriod) {
  const clients = db.clients.filter((c) => !c.isWalkIn);
  const referred = clients.filter((c) => c.referredBy || c.referredByClientId);
  const key = (c: (typeof clients)[number]) => (c.referredByClientId ? db.clients.find((x) => x.id === c.referredByClientId)?.name ?? c.referredBy ?? "" : c.referredBy ?? "").trim();
  const groups = new Map<string, { count: number; inPeriod: number; revenue: number; names: string[] }>();
  for (const c of referred) {
    const k = key(c);
    if (!k) continue;
    const g = groups.get(k) ?? { count: 0, inPeriod: 0, revenue: 0, names: [] };
    g.count += 1;
    if (inP(c.createdAt, p)) g.inPeriod += 1;
    g.revenue += db.invoices.filter((i) => i.clientId === c.id && i.kind === "facture" && isActiveInvoice(i)).reduce((s, i) => s + docTotal(i.lines), 0);
    g.names.push(c.name);
    groups.set(k, g);
  }
  return {
    referrers: Array.from(groups.entries()).map(([name, g]) => ({ name, ...g })).sort((a, b) => b.count - a.count || b.revenue - a.revenue),
    sources: count(clients.filter((c) => c.acquisition), (c) => c.acquisition!),
    unknown: clients.filter((c) => !c.acquisition && !c.referredBy).length,
  };
}
