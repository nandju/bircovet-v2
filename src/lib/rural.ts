/**
 * Rural (animaux de rente) : rubriques des rapports de visite de ferme et d'urgence.
 */
import type { Mission, RuralType } from "./types";

export const REPORT_SECTIONS: Record<RuralType, { key: string; label: string; hint: string }[]> = {
  visite: [
    { key: "motif", label: "Contexte et motif de la visite", hint: "Demande de l'éleveur, historique récent" },
    { key: "effectifs", label: "Effectifs, performances et mortalité", hint: "Bandes, âges, poids, ponte, mortalité cumulée" },
    { key: "batiments", label: "Bâtiments et ambiance", hint: "Densité, ventilation, litière, température" },
    { key: "alimentation", label: "Alimentation et abreuvement", hint: "Aliment, consommation, qualité de l'eau" },
    { key: "biosecurite", label: "Biosécurité et hygiène", hint: "Pédiluves, accès, nettoyage-désinfection, vide sanitaire" },
    { key: "clinique", label: "Examen clinique et autopsies", hint: "Signes observés, lésions" },
    { key: "diagnostic", label: "Diagnostic ou hypothèses", hint: "Conclusion, examens complémentaires demandés" },
    { key: "traitements", label: "Traitements et prescriptions", hint: "Produits, doses, durée, délais d'attente" },
    { key: "recommandations", label: "Recommandations à l'éleveur", hint: "Mesures concrètes à appliquer" },
  ],
  urgence: [
    { key: "constat", label: "Constat à l'arrivée", hint: "État des animaux, nombre de malades et de morts" },
    { key: "examen", label: "Examen et diagnostic", hint: "Signes cliniques, hypothèses" },
    { key: "prise_en_charge", label: "Prise en charge", hint: "Actes réalisés, traitements administrés, doses" },
    { key: "evolution", label: "Évolution et conduite à tenir", hint: "Surveillance, rappel prévu, isolement" },
    { key: "recommandations", label: "Recommandations à l'éleveur", hint: "Délais d'attente, mesures sanitaires" },
  ],
  mission: [
    { key: "deroulement", label: "Déroulement", hint: "Ce qui a été fait" },
    { key: "resultats", label: "Résultats et observations", hint: "" },
    { key: "recommandations", label: "Recommandations", hint: "" },
  ],
};

export const SEVERITY: Record<NonNullable<Mission["emergency"]>["severity"], { label: string; cls: string }> = {
  vitale: { label: "Pronostic vital engagé", cls: "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-300" },
  grave: { label: "Grave", cls: "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-300" },
  moderee: { label: "Modérée", cls: "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300" },
};

export function ruralTypeOf(m: Mission): RuralType {
  if (m.ruralType) return m.ruralType;
  if (m.category === "urgence" || m.category === "hors_horaires") return "urgence";
  if (m.category === "exploitation" && m.farmIds.length) return "visite";
  return "mission";
}

export const RURAL_LABEL: Record<RuralType, string> = { visite: "Visite de ferme", urgence: "Urgence", mission: "Mission" };

/** Version texte du rapport structuré (copie WhatsApp, historique de l'exploitation). */
export function composeReport(type: RuralType, sections: Record<string, string>): string {
  return REPORT_SECTIONS[type]
    .filter((s) => sections[s.key]?.trim())
    .map((s) => `${s.label.toUpperCase()}\n${sections[s.key].trim()}`)
    .join("\n\n");
}

/** Migration v6 → v7 : type rural des missions existantes et une urgence de démonstration. */
export function migrateToV7(db: import("./types").DemoDB, now: string): import("./types").DemoDB {
  const missions = db.missions.map((m) => ({ ...m, ruralType: m.ruralType ?? ruralTypeOf(m) }));
  const farm = db.farms[0];
  const leader = db.users.find((u) => u.roleId === "vet")?.id ?? db.users[0].id;
  if (farm && !missions.some((m) => m.ruralType === "urgence")) {
    const day = now.slice(0, 10);
    missions.unshift({
      id: "mis-urg-demo",
      code: `MIS-${String((db.counters.mission ?? missions.length) + 1).padStart(4, "0")}`,
      objective: "Mortalité brutale dans un lot",
      category: "urgence",
      serviceType: "intervention",
      date: day,
      endDate: day,
      location: farm.location,
      establishmentId: db.establishments[0].id,
      leaderId: leader,
      teamIds: [],
      farmIds: [farm.id],
      clientIds: [farm.clientId],
      plannedInterventions: ["Examen clinique et autopsies", "Prélèvements pour le laboratoire", "Traitement de première intention"],
      interventionsDone: [],
      actionItems: [],
      stock: [],
      observedHeadcounts: [],
      report: "",
      status: "en_cours",
      ruralType: "urgence",
      emergency: { calledAt: `${day}T06:40:00`, caller: farm.managerName || "Gérant de l'exploitation", callerPhone: farm.managerPhone || "", reason: "Une quarantaine de sujets morts depuis la nuit, abattement et diarrhée sur le reste du lot", animals: farm.lots[0]?.name ?? "Lot principal", severity: "vitale" },
    });
  }
  return { ...db, schemaVersion: 7, missions, counters: { ...db.counters, mission: Math.max(db.counters.mission ?? 0, missions.length) } };
}
