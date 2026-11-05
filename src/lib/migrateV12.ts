/**
 * Schéma v12 : avals du directeur, protocoles et fiches, liens externes,
 * lien Google Maps des exploitations, horodatage des rapports.
 */
import { addDay } from "./treatments";
import { demoProtocols } from "./protocols";
import type { ApprovalRequest, DemoDB, ExternalLink } from "./types";

export function migrateToV12(db: DemoDB, nowLocal: string): DemoDB {
  const today = nowLocal.slice(0, 10);
  if (db.protocols && db.approvals && db.links) return { ...db, schemaVersion: 12 };
  const has = (id: string) => db.users.some((u) => u.id === id);
  const u = (id: string) => (has(id) ? id : db.users[0].id);
  const dg = db.users.find((x) => x.roleId === "dg")?.id ?? db.users[0].id;

  // Rapports récents : horodatés aujourd'hui / hier pour la carte « rapports des collaborateurs ».
  const withReport = db.missions.filter((m) => m.report.trim()).sort((a, b) => b.date.localeCompare(a.date));
  const stamp = new Map<string, { at: string; by: string }>();
  withReport.slice(0, 4).forEach((m, i) => stamp.set(m.id, { at: `${i < 2 ? today : addDay(today, -1)}T${["17:40", "11:15", "18:05", "16:30"][i]}`, by: m.leaderId }));
  const missions = db.missions.map((m) => (stamp.has(m.id) ? { ...m, reportUpdatedAt: m.reportUpdatedAt ?? stamp.get(m.id)!.at, reportById: m.reportById ?? stamp.get(m.id)!.by } : m));

  const farms = db.farms.map((f, i) => (f.mapsUrl || i > 1 ? f : { ...f, mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${f.location}, Côte d'Ivoire`)}` }));

  const m0 = withReport[0];
  const approvals: ApprovalRequest[] = db.approvals ?? [
    ...(m0 ? [{ id: "apv-1", code: "AVAL-0001", refKind: "rapport" as const, refId: m0.id, link: `/missions/${m0.id}`, title: `Abattage sanitaire d'un lot — ${m0.code}`, detail: "Mortalités en hausse sur le lot le plus touché malgré le traitement. Je propose l'abattage sanitaire du lot et un vide sanitaire de 15 jours. L'éleveur attend la décision ce soir.", urgency: "urgente" as const, requestedById: u(m0.leaderId), requestedAt: `${today}T17:45`, toUserId: dg, status: "en_attente" as const, history: [{ date: `${today}T17:45`, userId: u(m0.leaderId), text: "Demande d'aval envoyée" }] }] : []),
    { id: "apv-2", code: "AVAL-0002", refKind: "facture", link: "/facturation", title: "Remise de 10 % pour un gros éleveur", detail: "Commande groupée de vaccins pour 6 000 pondeuses ; le client demande une remise de fidélité.", amount: 85000, urgency: "normale", requestedById: u("u-acc"), requestedAt: `${addDay(today, -1)}T10:20`, toUserId: dg, status: "en_attente", history: [{ date: `${addDay(today, -1)}T10:20`, userId: u("u-acc"), text: "Demande d'aval envoyée" }] },
    { id: "apv-3", code: "AVAL-0003", refKind: "commande", link: "/achats", title: "Commande urgente d'oxytétracycline", detail: "Stock sous le seuil avant la campagne ; commande de 40 flacons chez le fournisseur habituel.", amount: 240000, urgency: "normale", requestedById: u("u-asst1"), requestedAt: `${addDay(today, -3)}T09:00`, toUserId: dg, status: "approuvee", decisionNote: "D'accord, livraison avant vendredi.", decidedAt: `${addDay(today, -3)}T11:30`, history: [{ date: `${addDay(today, -3)}T09:00`, userId: u("u-asst1"), text: "Demande d'aval envoyée" }, { date: `${addDay(today, -3)}T11:30`, userId: dg, text: "Aval donné — D'accord, livraison avant vendredi." }] },
  ];

  const protocols = db.protocols ?? demoProtocols(u("u-vet1"), dg, `${addDay(today, -20)}T10:00`);
  const links: ExternalLink[] = db.links ?? [
    { id: "lnk-1", ref: { kind: "protocole", id: "pro-2" }, label: "Fiche de déclaration (modèle)", url: "https://docs.google.com/document/d/exemple-declaration", addedById: dg, addedAt: `${addDay(today, -10)}T09:00` },
    { id: "lnk-2", ref: { kind: "protocole", id: "pro-6" }, label: "Vidéo : préparation du site opératoire", url: "https://www.youtube.com/results?search_query=preparation+site+operatoire+veterinaire", addedById: u("u-vet1"), addedAt: `${addDay(today, -9)}T09:00` },
    ...(db.farms[0] ? [{ id: "lnk-3", ref: { kind: "exploitation" as const, id: db.farms[0].id }, label: "Registre d'élevage partagé", url: "https://docs.google.com/spreadsheets/d/exemple-registre", addedById: u("u-vet2"), addedAt: `${addDay(today, -5)}T09:00` }] : []),
  ];

  return { ...db, schemaVersion: 12, missions, farms, approvals, protocols, links, counters: { ...db.counters, apv: Math.max(db.counters.apv ?? 0, 3), pro: Math.max(db.counters.pro ?? 0, 6) } };
}
