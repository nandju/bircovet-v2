/**
 * Schéma v16 : inventaire du matériel, consultations à domicile, filigrane des documents.
 */
import { addDays } from "./format";
import type { Appointment, DemoDB, Equipment, HomeVisit } from "./types";

export function migrateToV16(db: DemoDB, nowLocal: string): DemoDB {
  const today = nowLocal.slice(0, 10);
  if (db.equipment) return { ...db, schemaVersion: 16 };
  const est = db.establishments[0]?.id ?? "est-abj";
  const at = `${today}T08:00:00`;
  const E = (n: number, e: Omit<Equipment, "id" | "code" | "establishmentId" | "createdAt" | "updatedAt">): Equipment => ({ ...e, id: `eqp-${n}`, code: `MAT-${String(n).padStart(4, "0")}`, establishmentId: est, createdAt: at, updatedAt: at });
  const equipment: Equipment[] = [
    E(1, { name: "Échographe portable", category: "Imagerie", brand: "Modèle démo E-30", serial: "EC30-2291", location: "Salle de consultation 1", quantity: 1, unitCost: 4_500_000, purchaseDate: addDays(today, -540), supplier: "Fournisseur démo Imagerie", condition: "bon", warrantyUntil: addDays(today, 190), nextMaintenance: addDays(today, 25) }),
    E(2, { name: "Table de chirurgie inox chauffante", category: "Médical et chirurgie", location: "Bloc opératoire", quantity: 1, unitCost: 1_200_000, purchaseDate: addDays(today, -900), supplier: "Équipement Véto démo", condition: "bon" }),
    E(3, { name: "Lampe scialytique", category: "Médical et chirurgie", location: "Bloc opératoire", quantity: 1, unitCost: 650_000, purchaseDate: addDays(today, -1500), condition: "use", notes: "Chauffe et éclaire mal : remplacement budgété (BUD-0002)." }),
    E(4, { name: "Autoclave 18 L", category: "Médical et chirurgie", brand: "Classe B", serial: "AC18-0457", location: "Stérilisation", quantity: 1, unitCost: 1_850_000, purchaseDate: addDays(today, -700), condition: "bon", nextMaintenance: addDays(today, -3) }),
    E(5, { name: "Analyseur de biochimie", category: "Laboratoire", location: "Laboratoire", quantity: 1, unitCost: 2_900_000, purchaseDate: addDays(today, -400), supplier: "Labo démo Diagnostic", condition: "bon", warrantyUntil: addDays(today, 330) }),
    E(6, { name: "Microscope binoculaire", category: "Laboratoire", location: "Laboratoire", quantity: 2, unitCost: 280_000, purchaseDate: addDays(today, -1200), condition: "bon" }),
    E(7, { name: "Cages d'hospitalisation inox", category: "Hospitalisation", location: "Chenil", quantity: 6, unitCost: 185_000, purchaseDate: addDays(today, -1000), condition: "bon" }),
    E(8, { name: "Pousse-seringue électrique", category: "Hospitalisation", location: "Hospitalisation", quantity: 2, unitCost: 420_000, purchaseDate: addDays(today, -300), condition: "neuf" }),
    E(9, { name: "Tondeuse vétérinaire", category: "Médical et chirurgie", location: "Salle de consultation 2", quantity: 2, unitCost: 95_000, purchaseDate: addDays(today, -200), condition: "panne", notes: "Une tête de coupe à remplacer." }),
    E(10, { name: "Réfrigérateur vaccins (chaîne du froid)", category: "Froid (chaîne du froid)", location: "Pharmacie", quantity: 1, unitCost: 550_000, purchaseDate: addDays(today, -800), condition: "bon", nextMaintenance: addDays(today, 40) }),
    E(11, { name: "Glacières isothermes terrain", category: "Véhicule et terrain", location: "Réserve missions", quantity: 3, unitCost: 45_000, purchaseDate: addDays(today, -350), condition: "bon" }),
    E(12, { name: "Ordinateur portable accueil", category: "Informatique et bureau", location: "Accueil", quantity: 1, unitCost: 450_000, purchaseDate: addDays(today, -600), condition: "bon" }),
    E(13, { name: "Imprimante multifonction", category: "Informatique et bureau", location: "Accueil", quantity: 1, unitCost: 180_000, purchaseDate: addDays(today, -500), condition: "bon" }),
    E(14, { name: "Comptoir d'accueil", category: "Mobilier", location: "Accueil", quantity: 1, unitCost: 300_000, purchaseDate: addDays(today, -1400), condition: "bon" }),
    E(15, { name: "Chaises salle d'attente", category: "Mobilier", location: "Salle d'attente", quantity: 8, unitCost: 25_000, purchaseDate: addDays(today, -1400), condition: "use" }),
  ];

  // Une urgence à domicile en cours et une visite programmée.
  const vet = db.users.find((u) => u.roleId === "vet" && u.active)?.id ?? db.users[0].id;
  const pets = db.patients.filter((p) => (p.species === "Chien" || p.species === "Chat") && p.vitalStatus === "vivant" && !p.archived);
  const mk = (id: string, p: (typeof pets)[number] | undefined, start: string, reason: HomeVisit["reason"], motif: string, fee: number): Appointment | null => {
    if (!p) return null;
    const c = db.clients.find((x) => x.id === p.ownerId);
    if (!c) return null;
    const address = [c.address, c.city].filter(Boolean).join(", ") || "Cocody, Abidjan";
    return {
      id, establishmentId: est, clientId: c.id, patientId: p.id, practitionerId: vet, start, durationMin: 60,
      reason: `${reason === "urgence" ? "Urgence à domicile" : "Consultation à domicile"} — ${motif}`, resource: "", status: reason === "urgence" ? "confirme" : "planifie", queueStatus: "attendu",
      reminder: { enabled: reason === "demande", channel: db.settings.reminderDefaultChannel, offsetHours: 2 },
      history: [{ date: `${today}T07:45:00`, userId: vet, action: "Création (visite à domicile)" }],
      kind: "domicile",
      home: { reason, address, mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address}, Côte d'Ivoire`)}`, travelFee: fee, contactPhone: c.phone },
    };
  };
  const visits = [mk("apt-home-1", pets[4], `${today}T10:30`, "urgence", "chienne en difficulté de mise bas", 10_000), mk("apt-home-2", pets[9], `${addDays(today, 2)}T16:00`, "demande", "vaccination et bilan d'un chat âgé qui ne supporte pas le transport", 5_000)].filter((a): a is Appointment => !!a);

  return {
    ...db,
    schemaVersion: 16,
    equipment,
    appointments: [...db.appointments.filter((a) => !a.id.startsWith("apt-home-")), ...visits],
    counters: { ...db.counters, eqp: Math.max(db.counters.eqp ?? 0, equipment.length) },
    settings: { ...db.settings, watermark: db.settings.watermark ?? { enabled: true, text: "BIRCOVET", opacity: 6, withLogo: false } },
  };
}
