/**
 * Schéma v20 : prises en charge en élevage, tâches d'équipe vérifiées, caisses de suivi, nouveaux tutoriels.
 */
import { lotHeadcount } from "./care";
import { HERD, speciesOf } from "./farmProfile";
import { addDays } from "./format";
import { lineTotal } from "./calc";
import { DEFAULT_TUTORIALS } from "./tutorials";
import type { CareCase, CashBox, DemoDB, Farm, Task } from "./types";

export function migrateToV20(db: DemoDB, nowLocal: string): DemoDB {
  const today = nowLocal.slice(0, 10);
  if (db.careCases) return { ...db, schemaVersion: 20 };
  const vet = db.users.find((u) => u.roleId === "vet" && u.active)?.id ?? db.users[0].id;
  const dg = db.users.find((u) => u.roleId === "dg")?.id ?? vet;
  const asst = db.users.find((u) => u.roleId === "assistant" && u.active)?.id ?? vet;
  const acc = db.users.find((u) => u.roleId === "accueil" && u.active)?.id ?? dg;
  const rente = HERD.filter((s) => s !== "Volaille" && s !== "Poisson");
  const farms = db.farms.map((f) => ({ ...f, animals: f.animals ?? [] })) as Farm[];
  const cases: CareCase[] = [];
  let n = 0;
  for (const f of farms.filter((x) => x.status === "actif")) {
    const lot = f.lots.find((l) => l.status === "actif" && (rente as readonly string[]).includes(speciesOf(l.species)));
    if (!lot || n >= 2) continue;
    const sp = speciesOf(lot.species);
    const tag = (k: number) => `${sp.slice(0, 2).toUpperCase()}-${String(100 + k + n * 10)}`;
    f.animals!.push(
      { id: `${f.id}-a1`, tag: tag(1), name: n ? undefined : "Bella", species: sp, sex: "femelle", ageText: "3 ans", lotId: lot.id, status: "present", addedAt: addDays(today, -30) },
      { id: `${f.id}-a2`, tag: tag(2), species: sp, sex: "male", ageText: "18 mois", lotId: lot.id, status: "present", addedAt: addDays(today, -30) },
    );
    const total = Math.max(2, lotHeadcount(f, lot.id));
    if (n === 0) {
      cases.push({
        id: "care-1", code: "PEC-0001", farmId: f.id, scope: "animal", reason: "appel", animalId: `${f.id}-a1`, lotId: lot.id, species: sp, count: 1, openedAt: addDays(today, -4), vetId: vet,
        complaint: "Ne mange plus depuis 2 jours, abattue, toux", exam: { temperature: 40.6, heartRate: 96, respRate: 42, findings: "Jetage nasal, râles à l'auscultation, muqueuses congestionnées" },
        diagnosis: "Suspicion de pasteurellose", treatments: [{ id: "ctr-1", product: "Oxytétracycline longue action", dose: "1 mL/10 kg", route: "IM", duration: "dose unique, à renouveler à J3", count: 1 }],
        advice: "Isoler les animaux malades. Eau propre à volonté. Surveiller l'appétit et la température. Rappeler le cabinet en cas d'aggravation.", status: "en_cours", nextCheck: addDays(today, -1),
        followUps: [{ id: "cfu-1", date: addDays(today, -2), byId: vet, channel: "appel", state: "amelioration", note: "Recommence à manger un peu, toux moins fréquente." }],
      });
      cases.push({
        id: "care-2", code: "PEC-0002", farmId: f.id, scope: "cheptel", reason: "pathologie", lotId: undefined, species: sp, count: total, openedAt: addDays(today, -3), vetId: vet, parentId: "care-1",
        complaint: "Suite au diagnostic sur PEC-0001 : 4 autres animaux toussent", exam: { findings: "Toux sur 4 animaux, appétit conservé chez les autres" },
        diagnosis: "Pasteurellose (troupeau)", treatments: [{ id: "ctr-2", product: "Oxytétracycline longue action", dose: "1 mL/10 kg", route: "IM", duration: "dose unique", count: total }],
        advice: "Nettoyer et désinfecter le local. Aérer la bergerie. Respecter le délai d'attente (lait, viande).", status: "en_cours", nextCheck: today, followUps: [],
      });
    } else {
      cases.push({
        id: "care-3", code: "PEC-0003", farmId: f.id, scope: "lot", reason: "traitement_routine", lotId: lot.id, species: sp, count: total, openedAt: addDays(today, -20), vetId: vet,
        complaint: "Déparasitage de routine", exam: { findings: "Bon état général" }, diagnosis: "", treatments: [{ id: "ctr-3", product: "Ivermectine 1 %", dose: "1 mL/50 kg", route: "SC", duration: "", count: total }],
        advice: "Changer la litière. Renouveler dans 3 mois.", status: "gueri", closedAt: addDays(today, -6), outcome: "Aucun effet indésirable signalé.", followUps: [{ id: "cfu-3", date: addDays(today, -6), byId: asst, channel: "whatsapp", state: "gueri", note: "Tout va bien d'après l'éleveur." }],
      });
    }
    n++;
  }
  const tasks: Task[] = [
    { id: "tsk-team-1", title: "Rapport de visite de la ferme (format Word)", description: "À partir des notes de la mission de la semaine.", assigneeId: asst, priority: "haute", dueDate: addDays(today, 1), status: "termine", category: "document", result: "Rapport rédigé", driveUrl: "https://drive.google.com/file/d/exemple-fictif/view", assignedById: dg, review: { status: "a_verifier" }, history: [{ date: `${addDays(today, -2)}T09:00`, userId: dg, action: "Tâche confiée" }, { date: `${today}T08:30`, userId: asst, action: "Déclarée faite" }] },
    { id: "tsk-team-2", title: "Inventaire du rayon vaccins", description: "Compter et noter les lots qui périment dans moins de 60 jours.", assigneeId: acc, priority: "normale", dueDate: addDays(today, 2), status: "a_faire", category: "equipe", result: "", assignedById: dg, history: [{ date: `${addDays(today, -1)}T10:00`, userId: dg, action: "Tâche confiée" }] },
    { id: "tsk-team-3", title: "Fiche conseils pour les éleveurs de lapins", description: "1 page, à imprimer pour le comptoir.", assigneeId: vet, priority: "basse", dueDate: addDays(today, -1), status: "en_cours", category: "document", result: "", assignedById: dg, history: [{ date: `${addDays(today, -5)}T10:00`, userId: dg, action: "Tâche confiée" }] },
  ];
  // Caisses de suivi : on y range quelques prestations existantes.
  const vacc = db.invoices.filter((i) => i.kind === "facture").flatMap((i) => i.lines.filter((l) => /vaccin/i.test(l.label)).map((l) => ({ i, l }))).slice(0, 4);
  const boxes: CashBox[] = [
    { id: "box-1", code: "CS-001", name: "Campagne de vaccination", description: "Actes et vaccins de la campagne en cours.", color: "blue", target: 500_000, active: true, createdAt: addDays(today, -30), entries: [...vacc.map(({ i, l }, k) => ({ id: `bxe-v${k}`, kind: "prestation" as const, invoiceId: i.id, lineId: l.id, label: `${l.label} · ${i.code}`, amount: lineTotal(l), date: i.date.slice(0, 10), byId: dg })), { id: "bxe-m1", kind: "entree" as const, label: "Participation de la mairie (fictive)", amount: 150_000, date: addDays(today, -10), byId: dg }] },
    { id: "box-2", code: "CS-002", name: "Suivi des élevages", description: "Visites, prises en charge et produits vendus aux éleveurs.", color: "orange", active: true, createdAt: addDays(today, -30), entries: [] },
  ];
  const tutos = db.tutorials ? [...db.tutorials, ...DEFAULT_TUTORIALS.filter((t) => !db.tutorials!.some((x) => x.id === t.id))] : db.tutorials;
  return { ...db, schemaVersion: 20, farms, careCases: cases, tasks: [...tasks, ...db.tasks.filter((t) => !t.id.startsWith("tsk-team-"))], cashBoxes: boxes, tutorials: tutos, counters: { ...db.counters, care: Math.max(db.counters.care ?? 0, cases.length), box: Math.max(db.counters.box ?? 0, boxes.length) } };
}
