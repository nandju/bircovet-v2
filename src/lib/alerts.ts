/**
 * Alertes paramétrables : chaque règle peut être activée, réglée (seuil),
 * adressée à des rôles et/ou à la personne concernée, avec ou sans push.
 */
import { invoiceBalance, isActiveInvoice } from "./calc";
import { addDays } from "./format";
import { openBills, soldQty } from "./payables";
import { stockAlerts } from "./services/reportsService";
import { objectiveState } from "./staff";
import { activeCourses, courseStats, daysWithoutNews } from "./treatments";
import type { AlertRule, AppNotification, DemoDB, RoleId } from "./types";
import { upcomingWorldDays } from "./worldDays";

export interface AlertDef {
  key: string;
  label: string;
  desc: string;
  group: "Actions et suivi" | "Clinique" | "Rural" | "Pharmacie et finances" | "Personnel et communication";
  unit?: string;
  level: AppNotification["level"];
  link: string;
  defaults: Omit<AlertRule, "key">;
}

const R = (roles: RoleId[], threshold: number, owner = true, push = true, enabled = true): Omit<AlertRule, "key"> => ({ enabled, threshold, roles, owner, push });

export const ALERT_DEFS: AlertDef[] = [
  { key: "actions_retard", group: "Actions et suivi", label: "Actions à mener en retard", desc: "Actions issues des visites et missions dont l'échéance est dépassée depuis au moins N jours.", unit: "jour(s) de retard", level: "alerte", link: "/missions/rapports", defaults: R(["dg"], 0) },
  { key: "actions_echeance", group: "Actions et suivi", label: "Actions à échéance proche", desc: "Rappel N jours avant l'échéance d'une action.", unit: "jour(s) avant", level: "info", link: "/missions/rapports", defaults: R([], 1, true, false) },
  { key: "relances_retard", group: "Actions et suivi", label: "Relances clients en retard", desc: "Relances de suivi (J3, J7, J30…) non faites depuis N jours.", unit: "jour(s)", level: "alerte", link: "/relation-client/suivi", defaults: R(["dg"], 1) },
  { key: "aval_attente", group: "Actions et suivi", label: "Avals du directeur en attente", desc: "Rappel au directeur pour les demandes d'aval non traitées depuis N heures.", unit: "heure(s)", level: "alerte", link: "/aval", defaults: R(["dg"], 4, false) },
  { key: "traitement_oubli", group: "Clinique", label: "Prise oubliée en hospitalisation", desc: "Prise échue non cochée par l'équipe.", level: "critique", link: "/traitements", defaults: R(["vet", "dg"], 0) },
  { key: "traitement_sans_nouvelles", group: "Clinique", label: "Traitement à domicile sans nouvelles", desc: "Aucune confirmation du propriétaire depuis N jours.", unit: "jour(s)", level: "alerte", link: "/traitements", defaults: R(["accueil"], 2) },
  { key: "traitement_aggravation", group: "Clinique", label: "Évolution défavorable", desc: "Aggravation signalée sous traitement.", level: "critique", link: "/traitements", defaults: R(["dg"], 0) },
  { key: "rapport_manquant", group: "Rural", label: "Rapport de visite manquant", desc: "Visite ou mission passée depuis N jours sans rapport.", unit: "jour(s)", level: "alerte", link: "/missions/rapports", defaults: R(["dg"], 1) },
  { key: "stock_bas", group: "Pharmacie et finances", label: "Stock sous le seuil", desc: "Articles sous leur seuil d'alerte.", level: "alerte", link: "/stock/alertes", defaults: R(["dg", "accueil"], 0, false, false) },
  { key: "peremption", group: "Pharmacie et finances", label: "Lots proches de la péremption", desc: "Lots périmant dans les N prochains jours.", unit: "jour(s)", level: "info", link: "/stock/alertes", defaults: R(["dg"], 30, false, false) },
  { key: "fournisseur_retard", group: "Pharmacie et finances", label: "Fournisseurs et prestataires en retard de paiement", desc: "Factures fournisseurs échues depuis au moins N jours et non réglées.", unit: "jour(s)", level: "critique", link: "/achats/dettes", defaults: R(["dg", "comptable"], 0, false) },
  { key: "fournisseur_echeance", group: "Pharmacie et finances", label: "Échéances fournisseurs proches", desc: "Factures à payer dans les N prochains jours.", unit: "jour(s) avant", level: "alerte", link: "/achats/dettes", defaults: R(["dg", "comptable"], 5, false) },
  { key: "fournisseur_payable", group: "Pharmacie et finances", label: "Vous pouvez payer un fournisseur", desc: "Les ventes des articles achetés couvrent au moins N FCFA d'une facture : réglez-la au fil des ventes.", unit: "FCFA minimum", level: "info", link: "/achats/dettes", defaults: R(["dg"], 10000, false) },
  { key: "fne_manquante", group: "Pharmacie et finances", label: "Numéro FNE à saisir", desc: "Factures validées (ventes rapides au comptoir comprises) sans numéro FNE depuis N heures.", unit: "heure(s)", level: "alerte", link: "/stock/vente", defaults: R(["dg", "accueil"], 2, false) },
  { key: "impayes", group: "Pharmacie et finances", label: "Factures impayées", desc: "Factures échues depuis plus de N jours.", unit: "jour(s)", level: "alerte", link: "/finances/creances", defaults: R(["dg", "comptable"], 15, false, false) },
  { key: "dossier_admin", group: "Personnel et communication", label: "Dossiers administratifs à échéance", desc: "Dossiers en retard ou dont l'échéance tombe dans les N prochains jours (patente, TVA, CNPS, assurances…).", unit: "jour(s)", level: "alerte", link: "/dossiers-admin", defaults: R(["dg"], 30, false) },
  { key: "conge_attente", group: "Personnel et communication", label: "Demandes d'absence à valider", desc: "Congés ou permissions en attente depuis N jours.", unit: "jour(s)", level: "info", link: "/personnel", defaults: R(["dg"], 1, false) },
  { key: "objectif_risque", group: "Personnel et communication", label: "Objectifs à risque ou en retard", desc: "Objectifs individuels qui décrochent.", level: "info", link: "/personnel", defaults: R(["dg"], 0, true, false) },
  { key: "journee_mondiale", group: "Personnel et communication", label: "Journée mondiale à préparer", desc: "Rappel N jours avant une journée mondiale (publication sur la page).", unit: "jour(s) avant", level: "info", link: "/agenda", defaults: R(["dg", "accueil"], 3, false, false) },
];

export function rulesOf(db: DemoDB): AlertRule[] {
  const saved = db.settings.alertRules ?? [];
  return ALERT_DEFS.map((d) => ({ key: d.key, ...d.defaults, ...saved.find((s) => s.key === d.key) }));
}

export interface PendingAlert {
  dedupe: string;
  notif: Omit<AppNotification, "id" | "date" | "read">;
}

/** Évalue toutes les règles actives ; une notification groupée par règle, par destinataire et par jour. */
export function evaluateAlerts(db: DemoDB, now: string): PendingAlert[] {
  const today = now.slice(0, 10);
  const out: PendingAlert[] = [];
  for (const rule of rulesOf(db).filter((r) => r.enabled)) {
    const def = ALERT_DEFS.find((d) => d.key === rule.key)!;
    const items = collect(db, rule, now); // { label, owner? }
    if (!items.length) continue;
    const base = { level: def.level, link: def.link, push: rule.push, rule: rule.key };
    const summary = (xs: typeof items) => `${xs.slice(0, 3).map((x) => x.label).join(" ; ")}${xs.length > 3 ? ` … (+${xs.length - 3})` : ""}`;
    if (rule.roles.length) out.push({ dedupe: `${rule.key}:roles:${today}`, notif: { ...base, title: `${def.label} (${items.length})`, body: summary(items), toRoles: rule.roles } });
    if (rule.owner) {
      const by = new Map<string, typeof items>();
      for (const it of items) if (it.owner) by.set(it.owner, [...(by.get(it.owner) ?? []), it]);
      for (const [owner, xs] of by) {
        const u = db.users.find((x) => x.id === owner);
        if (!u || rule.roles.includes(u.roleId)) continue; // déjà prévenu par son rôle
        out.push({ dedupe: `${rule.key}:${owner}:${today}`, notif: { ...base, title: `${def.label} — vous êtes concerné (${xs.length})`, body: summary(xs), toUserIds: [owner] } });
      }
    }
  }
  return out;
}

function collect(db: DemoDB, r: AlertRule, now: string): { label: string; owner?: string }[] {
  const today = now.slice(0, 10);
  const n = r.threshold;
  switch (r.key) {
    case "actions_retard":
      return db.missions.flatMap((m) => m.actionItems.filter((a) => !a.done && a.dueDate && a.dueDate <= addDays(today, -Math.max(1, n))).map((a) => ({ label: `${a.label} (${m.code})`, owner: a.assigneeId ?? m.leaderId })));
    case "actions_echeance":
      return db.missions.flatMap((m) => m.actionItems.filter((a) => !a.done && a.dueDate && a.dueDate >= today && a.dueDate <= addDays(today, n)).map((a) => ({ label: `${a.label} (${m.code})`, owner: a.assigneeId ?? m.leaderId })));
    case "relances_retard":
      return (db.followUps ?? []).filter((p) => p.status === "actif").flatMap((p) => p.touches.filter((t) => t.status === "a_faire" && t.dueDate <= addDays(today, -Math.max(1, n))).map((t) => ({ label: `${db.clients.find((c) => c.id === p.clientId)?.name ?? ""} — ${t.label ?? p.label}`, owner: p.ownerId })));
    case "aval_attente":
      return (db.approvals ?? []).filter((a) => a.status === "en_attente" && (new Date(now).getTime() - new Date(a.requestedAt).getTime()) / 3600000 >= n).map((a) => ({ label: a.title, owner: a.toUserId }));
    case "traitement_oubli":
      return activeCourses(db, today).filter((c) => c.setting === "hospitalisation").filter((c) => courseStats(c, now).overdue > 0).map((c) => ({ label: `${db.patients.find((p) => p.id === c.patientId)?.name} — ${c.label} (${courseStats(c, now).overdue})`, owner: c.responsibleId }));
    case "traitement_sans_nouvelles":
      return activeCourses(db, today).filter((c) => c.setting === "domicile" && daysWithoutNews(c, today) >= n).map((c) => ({ label: `${db.patients.find((p) => p.id === c.patientId)?.name} — ${c.label}`, owner: c.responsibleId }));
    case "traitement_aggravation":
      return activeCourses(db, today).filter((c) => courseStats(c, now).trend?.trend === "aggravation").map((c) => ({ label: `${db.patients.find((p) => p.id === c.patientId)?.name} — ${c.label}`, owner: c.vetId }));
    case "rapport_manquant":
      return db.missions.filter((m) => ["en_cours", "terminee"].includes(m.status) && !m.report.trim() && (m.endDate || m.date).slice(0, 10) <= addDays(today, -Math.max(1, n))).map((m) => ({ label: `${m.code} — ${m.objective}`, owner: m.leaderId }));
    case "stock_bas":
      return stockAlerts(db, today).low.map((p) => ({ label: p.name }));
    case "peremption":
      return db.lots.filter((l) => l.qtyAvailable > 0 && l.status !== "perime" && l.expiryDate >= today && l.expiryDate <= addDays(today, n)).map((l) => ({ label: `${db.products.find((p) => p.id === l.productId)?.name} (${l.expiryDate})` }));
    case "fournisseur_retard":
      return openBills(db, today).filter((s) => s.overdue && -s.daysToDue >= n).map((s) => ({ label: `${s.supplier?.name} — ${s.remaining.toLocaleString("fr-FR")} FCFA (${s.bill.code}, échue depuis ${-s.daysToDue} j)` }));
    case "fournisseur_echeance":
      return openBills(db, today).filter((s) => !s.overdue && s.bill.kind !== "depot_vente" && s.daysToDue <= n).map((s) => ({ label: `${s.supplier?.name} — ${s.remaining.toLocaleString("fr-FR")} FCFA le ${s.bill.dueDate.slice(8, 10)}/${s.bill.dueDate.slice(5, 7)}` }));
    case "fournisseur_payable":
      return openBills(db, today).filter((s) => s.bill.payAsSold && s.bill.kind !== "prestation" && Math.min(s.payableNow, s.remaining) >= Math.max(1, n)).map((s) => ({ label: `${s.supplier?.name} : ${Math.min(s.payableNow, s.remaining).toLocaleString("fr-FR")} FCFA couverts par les ventes (${s.bill.lines.filter((l) => soldQty(db, s.bill, l.productId) > 0).map((l) => db.products.find((p) => p.id === l.productId)?.name).slice(0, 2).join(", ")})` }));
    case "fne_manquante":
      return db.invoices.filter((i) => i.kind === "facture" && isActiveInvoice(i) && !i.fneNumber && i.date >= addDays(today, -7) && (new Date(now).getTime() - new Date(i.validatedAt ?? `${i.date}T08:00`).getTime()) / 3600000 >= n).map((i) => ({ label: `${i.code} — ${db.clients.find((c) => c.id === i.clientId)?.name ?? ""}` }));
    case "impayes":
      return db.invoices.filter((i) => isActiveInvoice(i) && i.kind === "facture" && i.dueDate < addDays(today, -n) && invoiceBalance(db, i) > 0).map((i) => ({ label: `${i.code} — ${db.clients.find((c) => c.id === i.clientId)?.name}` }));
    case "dossier_admin":
      return (db.adminFiles ?? []).filter((f) => f.status !== "complet" && (f.status === "en_retard" || (f.dueDate && f.dueDate <= addDays(today, n)))).map((f) => ({ label: `${f.name}${f.dueDate ? ` (${f.dueDate.slice(8, 10)}/${f.dueDate.slice(5, 7)})` : ""}` }));
    case "conge_attente":
      return (db.leaves ?? []).filter((l) => l.status === "en_attente" && l.requestedAt.slice(0, 10) <= addDays(today, -n)).map((l) => ({ label: `${db.users.find((u) => u.id === l.userId)?.name} (${l.start})` }));
    case "objectif_risque":
      return (db.objectives ?? []).filter((o) => ["a_risque", "en_retard"].includes(objectiveState(o, today))).map((o) => ({ label: `${db.users.find((u) => u.id === o.userId)?.name} — ${o.title}`, owner: o.userId }));
    case "journee_mondiale":
      return upcomingWorldDays(today, n).filter((w) => w.cat !== "fete" || n <= 3).map((w) => ({ label: `${w.title} (${w.date.slice(8, 10)}/${w.date.slice(5, 7)})` }));
    default:
      return [];
  }
}
