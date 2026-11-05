/**
 * Schéma v15 : dossiers administratifs, budgets, évaluations du personnel,
 * analyses de laboratoire dans les interventions d'élevage.
 */
import { ADMIN_DIRECTORY, ADMIN_FILES, ADMIN_OBLIGATIONS } from "./adminSeed";
import { STOCK_CATEGORY } from "./budgets";
import { addDay } from "./treatments";
import type { Budget, DemoDB, StaffEvaluation } from "./types";

export function migrateToV15(db: DemoDB, nowLocal: string): DemoDB {
  const today = nowLocal.slice(0, 10);
  if (db.adminFiles && db.budgets && db.evaluations) return { ...db, schemaVersion: 15 };
  const dg = db.users.find((u) => u.roleId === "dg")?.id ?? db.users[0].id;
  const asst = db.users.find((u) => u.roleId === "assistant")?.id ?? dg;
  const acc = db.users.find((u) => u.roleId === "accueil")?.id ?? dg;
  const month = today.slice(0, 7);
  const est = db.establishments[0]?.id;

  const budgets: Budget[] = db.budgets ?? [
    {
      id: "bud-1", code: "BUD-0001", title: "Budget de fonctionnement du mois", period: month, establishmentId: est, preparedById: acc,
      lines: [
        { id: "bl-1", category: STOCK_CATEGORY, label: "Médicaments et vaccins", amount: 900000, note: "Réassort courant + campagne volaille" },
        { id: "bl-2", category: STOCK_CATEGORY, label: "Aliments et accessoires", amount: 250000 },
        { id: "bl-3", category: db.settings.expenseCategories.find((c) => /carbur/i.test(c)) ?? db.settings.expenseCategories[0], label: "Carburant missions", amount: 120000 },
        { id: "bl-4", category: db.settings.expenseCategories.find((c) => /fourniture/i.test(c)) ?? db.settings.expenseCategories[0], label: "Fournitures et consommables", amount: 80000 },
      ],
      justification: "Hausse attendue des ventes de vaccins volaille (campagne) et deux visites de ferme supplémentaires.",
      status: "valide", submittedAt: `${month}-01T09:00:00`, decidedById: dg, decidedAt: `${month}-01T12:00:00`, decisionNote: "Validé, carburant ramené à 120 000.",
      history: [{ date: `${month}-01T09:00:00`, userId: acc, text: "Présenté au DG pour validation" }, { date: `${month}-01T12:00:00`, userId: dg, text: "Validé (ajusté : Carburant missions : 150 000 → 120 000)" }],
    },
    {
      id: "bud-2", code: "BUD-0002", title: "Équipement de la salle de chirurgie", period: month, establishmentId: est, preparedById: asst,
      lines: [
        { id: "bl-5", category: db.settings.expenseCategories.find((c) => /mat[ée]riel|[ée]quipement/i.test(c)) ?? db.settings.expenseCategories[0], label: "Lampe scialytique LED", amount: 350000 },
        { id: "bl-6", category: STOCK_CATEGORY, label: "Boîtes de chirurgie et fils", amount: 180000 },
      ],
      justification: "La lampe actuelle chauffe et éclaire mal : risque pour les stérilisations.",
      status: "soumis", submittedAt: `${today}T08:30:00`, history: [{ date: `${today}T08:30:00`, userId: asst, text: "Présenté au DG pour validation" }],
    },
  ];
  const purchaseOrders = db.purchaseOrders.map((p) => (p.status !== "brouillon" && p.status !== "annulee" && p.date.startsWith(month) && !p.budgetLineId ? { ...p, budgetLineId: "bl-1" } : p));

  const staff = db.users.filter((u) => u.active && !["dg", "confrere"].includes(u.roleId));
  const evaluations: StaffEvaluation[] = db.evaluations ?? staff.flatMap((u, i) => {
    const base = [4, 5, 3, 4, 4, 3, 5];
    const mk = (k: number, period: string, date: string, bonus: number): StaffEvaluation => ({
      id: `eval-${u.id}-${k}`, userId: u.id, period, date, byId: dg,
      scores: { ponctualite: Math.min(5, base[i % 7] + (k ? 0 : -1) + bonus), qualite: Math.min(5, base[(i + 1) % 7]), protocoles: Math.min(5, base[(i + 2) % 7] + bonus), client: Math.min(5, base[(i + 3) % 7]), equipe: 4, initiative: Math.min(5, base[(i + 4) % 7]) },
      strengths: ["Très apprécié des clients", "Rigoureux sur les protocoles", "Toujours disponible pour les urgences", "Bonne tenue du stock"][i % 4],
      improvements: ["Ponctualité le lundi matin", "Compléter les rapports le jour même", "Relancer les clients à temps", "Prendre plus d'initiatives"][i % 4],
      comment: "",
    });
    return [mk(0, "Septembre 2026", `${addDay(today, -35)}T17:00:00`, 0), mk(1, "Octobre 2026", `${addDay(today, -4)}T17:00:00`, 1)];
  });

  // Analyse de laboratoire et autopsie de démonstration.
  const farms = db.farms.map((f, i) => {
    if (i !== 0 || (f.interventions ?? []).some((x) => x.kind === "analyse")) return f;
    const sp = f.lots[0]?.species ?? "Volaille";
    return { ...f, interventions: [
      { id: `${f.id}-lab-1`, date: addDay(today, -3), kind: "autopsie" as const, species: sp, lotId: f.lots[0]?.id, count: 5, problem: "Mortalités brutales sur la bande A", lab: { result: "Pétéchies du proventricule, entérite hémorragique : suspicion de maladie de Newcastle", status: "resultat" as const }, note: "Prélèvements envoyés au laboratoire.", byId: dg },
      { id: `${f.id}-lab-2`, date: addDay(today, -2), kind: "analyse" as const, species: sp, lotId: f.lots[0]?.id, count: 5, problem: "Confirmation Newcastle", lab: { name: "Laboratoire national (fictif)", test: "PCR Newcastle + sérologie", status: "envoye" as const }, note: "Résultat attendu sous 5 jours.", byId: dg },
      ...(f.interventions ?? []),
    ] };
  });

  return {
    ...db, schemaVersion: 15, budgets, purchaseOrders, evaluations, farms,
    adminFiles: db.adminFiles ?? ADMIN_FILES.map((f) => ({ ...f, updatedAt: `${today}T08:00:00` })),
    adminDirectory: db.adminDirectory ?? ADMIN_DIRECTORY.map((e) => ({ ...e })),
    adminObligations: db.adminObligations ?? ADMIN_OBLIGATIONS.map((o) => ({ ...o })),
    counters: { ...db.counters, budget: Math.max(db.counters.budget ?? 0, 2) },
  };
}
