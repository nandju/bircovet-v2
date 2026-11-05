/**
 * Schéma v17 : projets et preuves des dépenses (liens Drive, photos de factures).
 */
import { addDays } from "./format";
import type { DemoDB, Project } from "./types";

export function migrateToV17(db: DemoDB, nowLocal: string): DemoDB {
  const today = nowLocal.slice(0, 10);
  if (db.projects) return { ...db, schemaVersion: 17 };
  const est = db.establishments[0]?.id ?? "est-abj";
  const dg = db.users.find((u) => u.roleId === "dg")?.id;
  const at = `${addDays(today, -40)}T09:00:00`;
  const projects: Project[] = [
    { id: "prj-1", code: "PRJ-0001", name: "Rénovation du bloc opératoire", description: "Peinture, carrelage, lampe scialytique et climatisation du bloc.", budget: 2_500_000, startDate: addDays(today, -40), endDate: addDays(today, 30), status: "en_cours", ownerId: dg, establishmentId: est, createdAt: at },
    { id: "prj-2", code: "PRJ-0002", name: "Campagne de vaccination antirabique", description: "Sensibilisation, déplacements et collations des équipes terrain.", budget: 800_000, startDate: addDays(today, -25), endDate: addDays(today, 5), status: "en_cours", ownerId: dg, establishmentId: est, createdAt: at },
    { id: "prj-3", code: "PRJ-0003", name: "Site web et réseaux sociaux", description: "Tournage de vidéos, visuels et hébergement.", status: "en_cours", establishmentId: est, createdAt: at },
  ];
  // Rattache quelques dépenses existantes aux projets de démonstration.
  const pick = (re: RegExp) => db.expenses.filter((e) => re.test(`${e.category} ${e.label}`)).slice(0, 2).map((e) => e.id);
  const toBloc = new Set(pick(/entretien|travaux|mat[ée]riel|fourniture/i));
  const toCamp = new Set(pick(/carbur|transport|d[ée]placement/i).filter((id) => !toBloc.has(id)));
  const expenses = db.expenses.map((e, i) =>
    toBloc.has(e.id)
      ? { ...e, projectId: "prj-1", proofLinks: i % 2 ? [{ id: `prf-demo-${i}`, label: "Facture (Drive, exemple fictif)", url: "https://drive.google.com/file/d/exemple-fictif/view", addedById: e.requestedById, addedAt: `${e.date}T12:00:00` }] : e.proofLinks }
      : toCamp.has(e.id)
        ? { ...e, projectId: "prj-2" }
        : e,
  );
  return { ...db, schemaVersion: 17, projects, expenses, counters: { ...db.counters, prj: Math.max(db.counters.prj ?? 0, projects.length) } };
}
