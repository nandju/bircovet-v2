/**
 * Schéma v18 : demandes de RDV validées par le praticien, familles de recettes, tutoriels.
 */
import { addDays } from "./format";
import { DEFAULT_FAMILIES } from "./revenue";
import { DEFAULT_TUTORIALS } from "./tutorials";
import type { Appointment, DemoDB } from "./types";

export function migrateToV18(db: DemoDB, nowLocal: string): DemoDB {
  const today = nowLocal.slice(0, 10);
  if (db.tutorials) return { ...db, schemaVersion: 18 };
  const dg = db.users.find((u) => u.roleId === "dg");
  const acc = db.users.find((u) => u.roleId === "accueil") ?? db.users[0];
  const est = db.establishments[0]?.id ?? "est-abj";
  const pets = db.patients.filter((p) => (p.species === "Chien" || p.species === "Chat") && p.vitalStatus === "vivant" && !p.archived);
  const mk = (id: string, i: number, day: number, hm: string, reason: string, note: string): Appointment | null => {
    const p = pets[i];
    if (!p || !dg) return null;
    return {
      id, establishmentId: est, clientId: p.ownerId, patientId: p.id, practitionerId: dg.id, start: `${addDays(today, day)}T${hm}`, durationMin: 30, reason, resource: "",
      status: "demande", queueStatus: "attendu",
      reminder: { enabled: true, channel: db.settings.reminderDefaultChannel, offsetHours: db.settings.reminderDefaultHours },
      request: { requestedById: acc.id, requestedAt: `${today}T08:20:00`, note },
      history: [{ date: `${today}T08:20:00`, userId: acc.id, action: "Demande de rendez-vous (à valider)" }],
    };
  };
  const reqs = [mk("apt-req-1", 6, 1, "10:00", "Consultation — boiterie", "Le client préfère le matin, il peut venir dès 9 h."), mk("apt-req-2", 12, 2, "15:30", "Stérilisation (prise de RDV)", "")].filter((a): a is Appointment => !!a);
  return {
    ...db,
    schemaVersion: 18,
    tutorials: structuredClone(DEFAULT_TUTORIALS),
    appointments: [...db.appointments.filter((a) => !a.id.startsWith("apt-req-")), ...reqs],
    settings: {
      ...db.settings,
      apptApproval: db.settings.apptApproval ?? { enabled: true, practitionerIds: dg ? [dg.id] : [] },
      revenueFamilies: db.settings.revenueFamilies ?? structuredClone(DEFAULT_FAMILIES),
    },
  };
}
