/**
 * Génération du jeu de données initial (100 % fictif) relatif à la date du jour,
 * afin que l'agenda, les échéances et les péremptions restent cohérents.
 */
import { docTotal } from "../calc";
import { addDays, isoDay, isoLocal } from "../format";
import type {
  Appointment,
  AuditEntry,
  Client,
  Consultation,
  DemoDB,
  DocumentItem,
  Expense,
  Farm,
  Hospitalization,
  Interaction,
  Invoice,
  InvoiceLine,
  Mission,
  Patient,
  Payment,
  PaymentMethod,
  Prescription,
  PurchaseOrder,
  Quote,
  Reception,
  StockLot,
  StockMovement,
  Task,
  TrainingSession,
} from "../types";
import { ACCOUNTS, ESTABLISHMENTS, PRODUCTS, SETTINGS, SUPPLIERS, TEMPLATES, TRAININGS, USERS } from "./base";

export const SCHEMA_VERSION = 3;

function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n: number, w = 4) => String(n).padStart(w, "0");

export function createSeed(now: Date = new Date()): DemoDB {
  const r = rng(20261011);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(r() * arr.length)];
  const int = (min: number, max: number) => Math.floor(r() * (max - min + 1)) + min;
  const today = isoDay(now);
  const D = (off: number) => addDays(today, off);
  const DT = (off: number, h: number, m = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + off);
    d.setHours(h, m, 0, 0);
    return isoLocal(d);
  };

  /* ---------------- Clients ---------------- */
  const people: [string, string][] = [
    ["Konan Brou Jean", "07 45 12 33 01"],
    ["Aminata Coulibaly", "05 44 21 10 02"],
    ["Serge Kouadio", "07 58 63 22 03"],
    ["Marie-Laure Ehui", "01 02 33 44 04"],
    ["Bakary Touré", "07 77 81 20 05"],
    ["Akissi Danho", "05 66 12 98 06"],
    ["Olivier Kacou", "07 09 87 65 07"],
    ["Nadia Fofana", "01 40 50 60 08"],
    ["Jean-Marc Aké", "07 21 43 65 09"],
    ["Rachel N'Dri", "05 31 41 59 10"],
    ["Moussa Sanogo", "07 12 13 14 11"],
    ["Christelle Amon", "01 98 76 54 12"],
    ["Didier Yapo", "07 65 43 21 13"],
    ["Salimata Koné", "05 55 66 77 14"],
    ["Hervé Tanoh", "07 88 99 00 15"],
    ["Estelle Gnahoré", "01 11 22 33 16"],
    ["Ismaël Cissé", "07 44 55 66 17"],
    ["Prisca Adou", "05 77 88 99 18"],
    ["Thierry Zadi", "07 10 20 30 19"],
    ["Clarisse Boka", "01 60 70 80 20"],
    ["Adama Diabaté", "07 23 45 67 21"],
    ["Jean Konan Brou", "07 45 12 33 01"], // doublon potentiel volontaire
  ];
  const companies: [string, string, Client["segment"]][] = [
    ["Ferme Avicole Les Palmiers SARL", "27 22 41 00 31", "eleveur"],
    ["Élevage Bovin Konan & Fils", "27 30 64 00 32", "eleveur"],
    ["Coopérative Porcine d'Anyama", "27 23 55 00 33", "eleveur"],
    ["GIE Moutons du Centre", "27 31 63 00 34", "eleveur"],
    ["Pisciculture Lagune Ébrié", "27 21 30 00 35", "professionnel"],
    ["Résidence Sécurité Canine SA", "27 22 48 00 36", "professionnel"],
  ];
  const cities = ["Abidjan — Cocody", "Abidjan — Marcory", "Abidjan — Yopougon", "Bingerville", "Yamoussoukro", "Grand-Bassam", "Bouaké"];
  const clients: Client[] = [];
  people.forEach(([name, phone], i) => {
    const city = i === 21 ? "Abidjan — Cocody" : pick(cities.slice(0, 5));
    clients.push({
      id: `cli-${pad(i + 1, 3)}`,
      code: `CLI-${pad(i + 1)}`,
      type: "particulier",
      name,
      phoneCode: "+225",
      phone,
      email: `${name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]+/g, ".")}@exemple.demo`,
      address: `Lot ${int(10, 400)}, ${city} (adresse fictive)`,
      city,
      contacts: i % 4 === 0 ? [{ id: `cc-${i}`, name: "Contact secondaire (fictif)", phone: "07 00 00 00 00", relation: "Conjoint(e)" }] : [],
      commPrefs: { sms: true, whatsapp: i % 2 === 0, email: i % 3 === 0, call: i % 5 === 0 },
      segment: i % 6 === 0 ? "premium" : "standard",
      payerName: name,
      payerTaxId: "",
      notes: [],
      status: i === 19 ? "archive" : "actif",
      establishmentId: city === "Yamoussoukro" ? "est-yam" : "est-abj",
      createdAt: D(-int(200, 600)),
      lastActivityAt: D(i === 16 || i === 18 ? -240 : -int(0, 60)),
    });
  });
  companies.forEach(([name, phone, segment], j) => {
    const i = people.length + j;
    clients.push({
      id: `cli-${pad(i + 1, 3)}`,
      code: `CLI-${pad(i + 1)}`,
      type: "entreprise",
      name,
      phoneCode: "+225",
      phone,
      email: `contact@${name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]+/g, "")}.demo`.slice(0, 60),
      address: `${["Route de Bingerville", "Axe Yamoussoukro–Tiébissou", "Anyama village", "Bouaké nord", "Grand-Bassam lagune", "Zone 4 Marcory"][j]} (adresse fictive)`,
      city: ["Bingerville", "Yamoussoukro", "Anyama", "Bouaké", "Grand-Bassam", "Abidjan — Marcory"][j],
      contacts: [{ id: `cc-e${j}`, name: "Responsable technique (fictif)", phone: "07 11 11 11 1" + j, relation: "Responsable d'exploitation" }],
      commPrefs: { sms: true, whatsapp: true, email: true, call: false },
      segment,
      payerName: `${name} — Service comptabilité`,
      payerTaxId: `CC-DEMO-${pad(j + 1)}`,
      notes: [],
      status: "actif",
      establishmentId: j === 1 ? "est-yam" : j === 3 ? "est-bke" : "est-abj",
      createdAt: D(-int(300, 700)),
      lastActivityAt: D(-int(0, 20)),
    });
  });
  const cli = (n: number) => `cli-${pad(n, 3)}`;
  const FARM_CLIENTS = [cli(23), cli(24), cli(25), cli(26), cli(27)];
  const SECURITY = cli(28);

  /* ---------------- Patients ---------------- */
  const dogBreeds = ["Berger allemand", "Rottweiler", "Boerboel", "Bichon", "Caniche", "Labrador", "Croisé", "Berger malinois", "Chihuahua"];
  const catBreeds = ["Européen", "Siamois", "Persan", "Croisé"];
  const petNames = ["Rex", "Bella", "Simba", "Nala", "Max", "Luna", "Rocky", "Mimi", "Tango", "Kira", "Oscar", "Zara", "Filou", "Choco", "Leo", "Maya", "Tiger", "Pepsi", "Bobby", "Lady", "Duke", "Nina", "Caramel", "Milo", "Sultan", "Perle", "Titan", "Isis"];
  const patients: Patient[] = [];
  let pi = 0;
  const addPatient = (ownerId: string, species: string, breed: string, extra: Partial<Patient> = {}) => {
    pi++;
    const id = `pat-${pad(pi, 3)}`;
    const vets = ["u-vet1", "u-dg", "u-vet2"];
    const w = species === "Chat" ? 3 + r() * 3 : species === "Chien" ? 8 + r() * 30 : 250 + r() * 200;
    patients.push({
      id,
      code: `PAT-${pad(pi)}`,
      name: petNames[(pi - 1) % petNames.length] + (pi > petNames.length ? " II" : ""),
      species,
      breed,
      sex: pick(["male", "femelle", "male_castre", "femelle_sterilisee"] as const),
      birthDate: D(-int(200, 3600)),
      birthDateEstimated: r() < 0.3,
      chip: r() < 0.6 ? `250DEMO${int(10000000, 99999999)}` : "",
      passport: r() < 0.2 ? `PASS-DEMO-${int(1000, 9999)}` : "",
      insurance: r() < 0.15 ? "Assurance animale fictive — contrat démo" : "",
      color: pick(["Fauve", "Noir", "Blanc", "Tricolore", "Bringé", "Gris"]),
      ownerId,
      ownerHistory: [{ clientId: ownerId, from: D(-int(300, 900)), reason: "Premier enregistrement" }],
      allergies: r() < 0.15 ? ["Allergie déclarée (donnée fictive)"] : [],
      alerts: r() < 0.12 ? ["Animal craintif — manipulation prudente"] : [],
      vitalStatus: "vivant",
      vitals: [0, 1, 2].map((k) => ({
        id: `vit-${id}-${k}`,
        date: D(-30 * (3 - k) - int(0, 10)),
        weightKg: Math.round((w + (k - 1) * 0.4) * 10) / 10,
        temperature: Math.round((38 + r() * 1.2) * 10) / 10,
        heartRate: int(70, 130),
        respRate: int(14, 30),
        authorId: pick(vets.concat("u-asst1")),
      })),
      vaccinations:
        species === "Chien" || species === "Chat"
          ? [
              {
                id: `vac-${id}-1`,
                name: species === "Chien" ? "Vaccin CHPPiL démo" : "Vaccin typhus-coryza démo",
                date: D(-int(100, 330)),
                nextDue: D(int(-20, 120)),
                authorId: pick(vets),
                lotRef: "LOT-DEMO",
              },
            ]
          : [],
      notes: [],
      archived: false,
      createdAt: D(-int(300, 900)),
      ...extra,
    });
    return id;
  };
  for (let i = 1; i <= 22; i++) {
    const n = i % 3 === 0 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const isCat = (i + k) % 3 === 1;
      addPatient(cli(i), isCat ? "Chat" : "Chien", isCat ? pick(catBreeds) : pick(dogBreeds));
    }
  }
  const secDogs = [1, 2, 3].map(() => addPatient(SECURITY, "Chien", "Berger malinois", { alerts: ["Chien de garde — muselière recommandée"] }));
  addPatient(cli(24), "Bovin", "Zébu (taureau reproducteur)", { chip: "BOUCLE-DEMO-1182" });
  // patient décédé (historique)
  patients[6].vitalStatus = "decede";
  patients[6].deathDate = D(-45);
  patients[6].deathReason = "Décès constaté (donnée fictive)";
  // cession de propriété avec historique
  patients[9].ownerHistory = [
    { clientId: cli(5), from: D(-700), to: D(-90), reason: "Premier propriétaire" },
    { clientId: patients[9].ownerId, from: D(-90), reason: "Cession — dette antérieure conservée par l'ancien propriétaire" },
  ];
  const petPatients = patients.filter((p) => p.vitalStatus === "vivant" && (p.species === "Chien" || p.species === "Chat"));

  /* ---------------- Exploitations ---------------- */
  const farmDefs: [string, Farm["type"], string, string, string, number][] = [
    ["Ferme Les Palmiers", "avicole", "Bingerville", "Lagunes", "Poulets de chair", 12000],
    ["Ranch Konan", "bovin", "Tiébissou", "Bélier", "Bovins zébu", 180],
    ["Porcherie communautaire d'Anyama", "porcin", "Anyama", "Lagunes", "Porcins", 420],
    ["Bergerie du Centre", "ovin_caprin", "Bouaké", "Gbêkê", "Ovins Djallonké", 260],
    ["Bassins Lagune Ébrié", "piscicole", "Grand-Bassam", "Sud-Comoé", "Tilapia", 30000],
  ];
  const farms: Farm[] = farmDefs.map(([name, type, location, region, species, size], i) => {
    const id = `farm-${i + 1}`;
    const lots = [
      { id: `${id}-lot-1`, name: `Bande ${i + 1}-A`, species, buildingId: `${id}-b-1`, startDate: D(-90 - i * 10), status: "actif" as const },
      { id: `${id}-lot-2`, name: `Bande ${i + 1}-B`, species, buildingId: `${id}-b-2`, startDate: D(-40), status: "actif" as const },
    ];
    return {
      id,
      code: `EXP-${pad(i + 1)}`,
      name,
      clientId: FARM_CLIENTS[i],
      type,
      location,
      region,
      gps: `${(5 + r() * 3).toFixed(4)}, -${(3.5 + r() * 2).toFixed(4)}`,
      access: "Piste praticable en saison sèche ; prévenir le gérant 24 h avant (fictif).",
      managerName: ["M. Ouédraogo", "M. Konan Kouamé", "Mme Ahoua", "M. Diarra", "Mme Lath"][i],
      managerPhone: `07 33 44 55 ${pad(i, 2)}`,
      contacts: [{ id: `${id}-c1`, name: "Technicien d'élevage (fictif)", phone: `05 22 33 44 ${pad(i, 2)}`, relation: "Technicien" }],
      status: i === 4 ? "suspendu" : "actif",
      buildings: [
        { id: `${id}-b-1`, name: "Bâtiment 1", kind: type === "piscicole" ? "Bassin" : "Bâtiment d'élevage", capacity: Math.round(size * 0.6) },
        { id: `${id}-b-2`, name: "Bâtiment 2", kind: type === "piscicole" ? "Bassin" : "Bâtiment d'élevage", capacity: Math.round(size * 0.5) },
      ],
      lots,
      headcounts: lots.flatMap((l, k) => [
        { id: `${l.id}-h1`, lotId: l.id, date: D(-60 + k * 5), count: Math.round(size * (0.5 - k * 0.15)), authorId: "u-vet2", source: "visite" as const },
        { id: `${l.id}-h2`, lotId: l.id, date: D(-10), count: Math.round(size * (0.48 - k * 0.15)), authorId: "u-asst2", source: "mission" as const },
      ]),
      movements: [
        { id: `${id}-m1`, lotId: lots[0].id, date: D(-90), type: "entree", count: Math.round(size * 0.5), note: "Mise en place (fictif)" },
        { id: `${id}-m2`, lotId: lots[0].id, date: D(-25), type: "mortalite", count: Math.max(1, Math.round(size * 0.01)), note: "Mortalité déclarée (fictif)" },
      ],
      visits: [
        { id: `${id}-v1`, date: D(-60), vetId: "u-vet2", purpose: "Visite de suivi sanitaire", report: "Visite de routine — observations fictives consignées." },
        { id: `${id}-v2`, date: D(-12), vetId: i % 2 ? "u-dg" : "u-vet2", purpose: "Contrôle des effectifs", report: "Effectifs contrôlés, aucune anomalie administrative (fictif)." },
      ],
      createdAt: D(-500),
    };
  });

  /* ---------------- Stock : lots & mouvements ---------------- */
  const lots: StockLot[] = [];
  const movements: StockMovement[] = [];
  let lotN = 0;
  const mkLot = (productId: string, est: string, received: number, receivedOff: number, expiryOff: number, status: StockLot["status"] = "disponible", receptionId?: string) => {
    lotN++;
    const prod = PRODUCTS.find((p) => p.id === productId)!;
    const id = `lot-${pad(lotN, 3)}`;
    const e = ESTABLISHMENTS.find((x) => x.id === est)!;
    lots.push({
      id,
      ref: `L${prod.code.replace("-", "")}-${pad(lotN, 3)}`,
      productId,
      supplierId: prod.supplierId,
      establishmentId: est,
      location: prod.category === "vaccin" ? e.locations.find((l) => l.toLowerCase().includes("frig")) ?? e.locations[0] : e.locations[0],
      receivedAt: D(receivedOff),
      expiryDate: D(expiryOff),
      qtyReceived: received,
      qtyAvailable: received,
      unitCost: Math.round(prod.purchasePrice / prod.conversion) || prod.purchasePrice,
      status,
      receptionId,
    });
    movements.push({
      id: `mv-rec-${id}`,
      date: DT(receivedOff, 9, 0),
      productId,
      lotId: id,
      establishmentId: est,
      type: "reception",
      qty: received,
      userId: "u-acc",
      ref: receptionId ? { kind: "reception", id: receptionId } : undefined,
      note: "Réception initiale (données de démonstration)",
      opKey: `seed-rec-${id}`,
    });
    return id;
  };
  PRODUCTS.forEach((prod, idx) => {
    const t = prod.alertThreshold;
    if (prod.id === "prd-04") {
      mkLot(prod.id, "est-abj", 6, -400, -10, "perime");
      mkLot(prod.id, "est-abj", 12, -60, 25);
      mkLot(prod.id, "est-abj", 10, -20, 420);
      return;
    }
    if (prod.id === "prd-02") {
      mkLot(prod.id, "est-abj", 8, -50, 300, "quarantaine");
      mkLot(prod.id, "est-abj", 12, -90, 200);
      return;
    }
    if (prod.id === "prd-06") {
      mkLot(prod.id, "est-abj", 30, -120, 150);
      return;
    }
    if (prod.id === "prd-07") {
      mkLot(prod.id, "est-abj", 20, -150, 18);
      mkLot(prod.id, "est-abj", 30, -15, 330);
      mkLot(prod.id, "est-yam", 15, -40, 260);
      return;
    }
    if (prod.id === "prd-17") {
      mkLot(prod.id, "est-abj", 40, -100, 700);
      return;
    }
    mkLot(prod.id, "est-abj", Math.max(5, t * int(2, 4)), -int(60, 160), int(90, 700), "disponible", idx < 6 ? "rec-1" : undefined);
    if (idx % 2 === 0) mkLot(prod.id, "est-abj", Math.max(5, t * 2), -int(10, 50), int(200, 800));
    if (["vaccin", "antiparasitaire", "medicament"].includes(prod.category) && idx % 3 !== 1) mkLot(prod.id, "est-yam", Math.max(4, t), -int(20, 90), int(120, 500));
  });
  const movement = (lotId: string, type: StockMovement["type"], qty: number, date: string, userId: string, note: string, ref?: StockMovement["ref"], opKey?: string) => {
    const lot = lots.find((l) => l.id === lotId)!;
    const id = `mv-${movements.length + 1}`;
    movements.push({ id, date, productId: lot.productId, lotId, establishmentId: lot.establishmentId, type, qty, userId, ref, note, opKey: opKey ?? `seed-${id}` });
    lot.qtyAvailable += qty;
    return id;
  };
  const firstLot = (productId: string, est = "est-abj") =>
    lots.filter((l) => l.productId === productId && l.establishmentId === est && l.status === "disponible" && l.expiryDate >= today).sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))[0];
  // Délivrances historiques pour donner vie aux courbes
  for (let k = 0; k < 40; k++) {
    const prod = pick(PRODUCTS.filter((p) => p.salePrice > 0 && p.id !== "prd-06" && p.id !== "prd-17"));
    const lot = firstLot(prod.id);
    if (!lot || lot.qtyAvailable < 3) continue;
    movement(lot.id, "delivrance", -int(1, 2), DT(-int(1, 170), int(8, 17)), pick(["u-acc", "u-asst1"]), "Délivrance comptoir (historique fictif)");
  }
  movement(firstLot("prd-06").id, "administration", -14, DT(-12, 10), "u-vet1", "Vaccinations (historique fictif)");
  movement(firstLot("prd-17").id, "administration", -18, DT(-6, 11), "u-asst1", "Pose de cathéters (historique fictif)");

  /* ---------------- Agenda ---------------- */
  const appointments: Appointment[] = [];
  const reasons = ["Consultation générale", "Vaccination", "Contrôle post-opératoire", "Boiterie", "Troubles digestifs", "Dermatologie", "Bilan de santé", "Vermifugation", "Suivi de plaie", "Identification électronique"];
  let apN = 0;
  const addAppt = (off: number, h: number, mi: number, patient: Patient, practitionerId: string, status: Appointment["status"], queueStatus: Appointment["queueStatus"], extra: Partial<Appointment> = {}) => {
    apN++;
    const est = USERS.find((x) => x.id === practitionerId)!.establishmentId;
    const a: Appointment = {
      id: `apt-${pad(apN, 3)}`,
      establishmentId: est,
      clientId: patient.ownerId,
      patientId: patient.id,
      practitionerId,
      start: DT(off, h, mi),
      durationMin: ESTABLISHMENTS.find((e) => e.id === est)!.slotMinutes,
      reason: pick(reasons),
      resource: ESTABLISHMENTS.find((e) => e.id === est)!.resources[practitionerId === "u-dg" ? 1 : 0],
      status,
      queueStatus,
      reminder: { enabled: true, channel: "sms", offsetHours: 24, simulatedAt: off <= 0 ? DT(off - 1, 9) : undefined },
      history: [{ date: DT(off - 3, 10), userId: "u-acc", action: "Rendez-vous créé" }],
      ...extra,
    };
    appointments.push(a);
    return a;
  };
  // Aujourd'hui
  const todaySlots: [number, number, string, Appointment["status"], Appointment["queueStatus"]][] = [
    [8, 30, "u-vet1", "honore", "termine"],
    [9, 0, "u-dg", "honore", "termine"],
    [9, 30, "u-vet1", "honore", "en_consultation"],
    [10, 0, "u-dg", "confirme", "regle"],
    [10, 30, "u-vet1", "confirme", "arrive"],
    [11, 0, "u-vet1", "confirme", "attendu"],
    [14, 0, "u-dg", "planifie", "attendu"],
    [15, 0, "u-vet1", "planifie", "attendu"],
  ];
  todaySlots.forEach(([h, mi, who, st, q], k) => addAppt(0, h, mi, petPatients[k], who, st, q));
  addAppt(0, 9, 0, petPatients[30] ?? petPatients[8], "u-vet2", "honore", "termine");
  addAppt(0, 10, 0, petPatients[31] ?? petPatients[9], "u-vet2", "confirme", "arrive");
  // Passé
  for (let k = 0; k < 70; k++) {
    const off = -int(1, 90);
    const st = r() < 0.8 ? "honore" : r() < 0.6 ? "annule" : "absent";
    addAppt(off, int(8, 16), pick([0, 30]), pick(petPatients), pick(["u-vet1", "u-dg", "u-vet2"]), st, st === "honore" ? "termine" : "annule", st === "annule" ? { cancelReason: "Empêchement du client (fictif)" } : {});
  }
  // Futur
  for (let k = 0; k < 22; k++) {
    addAppt(int(1, 14), int(8, 16), pick([0, 30]), pick(petPatients), pick(["u-vet1", "u-dg", "u-vet2"]), r() < 0.5 ? "confirme" : "planifie", "attendu");
  }
  const unavailabilities = [
    { id: "una-1", userId: "u-vet1", start: DT(1, 14), end: DT(1, 18), reason: "Formation continue (fictif)" },
    { id: "una-2", userId: "u-dg", start: DT(3, 8), end: DT(3, 12), reason: "Réunion de direction" },
    { id: "una-3", userId: "u-vet2", start: DT(2, 8), end: DT(2, 17), reason: "Mission terrain" },
  ];

  /* ---------------- Consultations & factures ---------------- */
  const consultations: Consultation[] = [];
  const invoices: Invoice[] = [];
  const payments: Payment[] = [];
  let coN = 0;
  let invN = 0;
  let payN = 0;
  const methodAccount = (m: PaymentMethod, est: string) =>
    m === "especes" ? (est === "est-yam" ? "acc-caisse-yam" : "acc-caisse-abj") : m === "mobile_money" ? pick(["acc-om", "acc-wave"]) : "acc-banque";
  const addInvoice = (clientId: string, est: string, date: string, lines: InvoiceLine[], payRatio: number, extra: Partial<Invoice> = {}) => {
    invN++;
    const c = clients.find((x) => x.id === clientId)!;
    const inv: Invoice = {
      id: `inv-${pad(invN, 3)}`,
      code: `${SETTINGS.invoicePrefix}-${pad(invN)}`,
      kind: "facture",
      clientId,
      payerName: c.payerName,
      establishmentId: est,
      date,
      dueDate: addDays(date, c.type === "entreprise" ? 30 : 7),
      lines,
      status: "validee",
      authorId: "u-acc",
      validatedById: "u-dg",
      validatedAt: date,
      creditNoteIds: [],
      fiscalStatus: "non_concerne_demo",
      notes: "",
      ...extra,
    };
    invoices.push(inv);
    const total = docTotal(lines);
    if (payRatio > 0 && inv.status !== "brouillon" && inv.status !== "a_valider") {
      payN++;
      const method = pick<PaymentMethod>(["especes", "especes", "mobile_money", "mobile_money", "carte", "virement"]);
      const amount = Math.round((total * payRatio) / 100) * 100;
      payments.push({
        id: `pay-${pad(payN, 3)}`,
        code: `DEMO-ENC-${pad(payN)}`,
        date,
        clientId,
        amount,
        method,
        accountId: methodAccount(method, est),
        kind: "reglement",
        allocations: [{ invoiceId: inv.id, amount }],
        reference: method === "mobile_money" ? `MM-SIM-${int(100000, 999999)}` : "",
        userId: "u-acc",
        opKey: `seed-pay-${payN}`,
        note: "",
      });
    }
    return inv;
  };
  const actsFor = (reason: string) => {
    const acts = [{ id: "", label: "Consultation", qty: 1, unitPrice: 15000 }];
    if (reason === "Vaccination") acts.push({ id: "", label: "Acte de vaccination", qty: 1, unitPrice: 9000 });
    if (reason === "Dermatologie" || reason === "Troubles digestifs") acts.push({ id: "", label: "Examen complémentaire (démo)", qty: 1, unitPrice: 20000 });
    if (reason === "Suivi de plaie" || reason === "Contrôle post-opératoire") acts.push({ id: "", label: "Soins et pansement", qty: 1, unitPrice: 8000 });
    if (reason === "Identification électronique") acts.push({ id: "", label: "Pose de puce (démo)", qty: 1, unitPrice: 18000 });
    return acts.map((a, k) => ({ ...a, id: `act-${coN}-${k}` }));
  };
  const addConsultation = (patient: Patient, date: string, vetId: string, extra: Partial<Consultation> = {}) => {
    coN++;
    const reason = extra.reason ?? pick(reasons);
    const vet = USERS.find((x) => x.id === vetId)!;
    const c: Consultation = {
      id: `con-${pad(coN, 3)}`,
      code: `CONS-${pad(coN)}`,
      establishmentId: vet.establishmentId,
      clientId: patient.ownerId,
      patientId: patient.id,
      date,
      reason,
      anamnesis: "Anamnèse de démonstration rédigée à des fins de test d'interface.",
      exam: "Examen clinique fictif — paramètres dans les limites saisies par le praticien.",
      weightKg: patient.vitals[patient.vitals.length - 1]?.weightKg,
      temperature: Math.round((38 + r()) * 10) / 10,
      heartRate: int(70, 120),
      respRate: int(14, 28),
      hypotheses: "Hypothèses fictives (démonstration).",
      diagnosis: "Diagnostic fictif saisi par le vétérinaire (démonstration).",
      complementaryExams: reason === "Dermatologie" ? "Raclage cutané (fictif)" : "",
      carePlan: "Plan de soins fictif défini par le vétérinaire responsable.",
      observations: "",
      followUpDate: r() < 0.3 ? addDays(date.slice(0, 10), 14) : undefined,
      vetId,
      authorId: r() < 0.25 ? "u-asst1" : vetId,
      status: "valide",
      validatedById: vetId,
      validatedAt: date,
      financialStatus: "regle_avance",
      acts: actsFor(reason),
      ...extra,
    };
    consultations.push(c);
    return c;
  };
  // Historique 6 mois
  for (let k = 0; k < 220; k++) {
    const off = -int(1, 180);
    const patient = pick(petPatients.filter((p) => p.ownerId !== SECURITY));
    const vetId = pick(["u-vet1", "u-vet1", "u-dg", "u-vet2"]);
    const c = addConsultation(patient, DT(off, int(8, 17), pick([0, 30])), vetId);
    const ratio = off < -40 ? (r() < 0.92 ? 1 : 0.5) : r() < 0.7 ? 1 : r() < 0.5 ? 0.5 : 0;
    const inv = addInvoice(
      c.clientId,
      c.establishmentId,
      c.date.slice(0, 10),
      c.acts.map((a, j) => ({ id: `il-${c.id}-${j}`, label: a.label, kind: "service" as const, qty: a.qty, unitPrice: a.unitPrice, discountPct: 0, source: { kind: "consultation" as const, id: c.id, label: c.code } })),
      ratio,
    );
    c.invoiceId = inv.id;
    c.financialStatus = "facture";
  }
  // Consultations du jour
  const cToday1 = addConsultation(petPatients[2], DT(0, 9, 35), "u-vet1", {
    status: "brouillon",
    validatedById: undefined,
    validatedAt: undefined,
    authorId: "u-vet1",
    appointmentId: appointments[2].id,
    reason: "Boiterie",
    diagnosis: "",
    financialStatus: "regle_avance",
  });
  appointments[2].consultationId = cToday1.id;
  const cToday2 = addConsultation(petPatients[0], DT(0, 8, 35), "u-vet1", {
    status: "a_valider",
    validatedById: undefined,
    validatedAt: undefined,
    authorId: "u-asst1",
    appointmentId: appointments[0].id,
    reason: "Vaccination",
    financialStatus: "regle_avance",
  });
  appointments[0].consultationId = cToday2.id;
  const cToday3 = addConsultation(petPatients[1], DT(0, 9, 5), "u-dg", { appointmentId: appointments[1].id, reason: "Bilan de santé", financialStatus: "non_regle" });
  appointments[1].consultationId = cToday3.id;
  // Visites non facturées d'un même payeur (facturation regroupée)
  const secPatients = patients.filter((p) => secDogs.includes(p.id));
  secPatients.forEach((p, k) =>
    addConsultation(p, DT(-[18, 11, 4][k], 10), "u-vet1", {
      reason: k === 0 ? "Vaccination" : "Bilan de santé",
      financialStatus: "exception_approuvee",
      paymentException: { requestedById: "u-acc", reason: "Client entreprise — facturation mensuelle groupée (démo)", decidedById: "u-dg", decision: "approuvee", date: D(-20) },
    }),
  );
  // Euthanasie saisie sans changement automatique du statut vital (démo règle)
  addConsultation(petPatients[12], DT(-2, 16), "u-dg", {
    reason: "Consultation générale",
    euthanasiaRecorded: true,
    observations: "Acte d'euthanasie saisi à titre de démonstration : le statut vital n'est PAS modifié automatiquement.",
    financialStatus: "non_regle",
  });

  // Quelques factures particulières
  const invDraft = addInvoice(cli(3), "est-abj", D(-1), [{ id: "il-d1", label: "Aliment chien adulte démo 15 kg", kind: "produit", productId: "prd-18", qty: 1, unitPrice: 27000, discountPct: 0, source: { kind: "vente", id: "vente-1", label: "Vente comptoir" } }], 0, { status: "brouillon", validatedById: undefined, validatedAt: undefined });
  const invToValidate = addInvoice(cli(8), "est-abj", D(0), [
    { id: "il-v1", label: "Consultation", kind: "service", qty: 1, unitPrice: 15000, discountPct: 0 },
    { id: "il-v2", label: "Pipette antiparasitaire démo chien", kind: "produit", productId: "prd-11", qty: 3, unitPrice: 4500, discountPct: 15 },
  ], 0, { status: "a_valider", validatedById: undefined, validatedAt: undefined, notes: "Remise de 15 % au-delà de la délégation (10 %) : validation DG requise." });
  void invDraft;
  void invToValidate;
  // Avoir lié à une facture
  const origForCredit = invoices.find((i) => i.status === "validee" && i.kind === "facture" && i.lines.length > 1)!;
  invN++;
  const creditNote: Invoice = {
    id: `inv-${pad(invN, 3)}`,
    code: `DEMO-AV-${pad(1)}`,
    kind: "avoir",
    clientId: origForCredit.clientId,
    payerName: origForCredit.payerName,
    establishmentId: origForCredit.establishmentId,
    date: addDays(origForCredit.date, 2),
    dueDate: addDays(origForCredit.date, 2),
    lines: [{ ...origForCredit.lines[1], id: "il-av-1", label: `Annulation : ${origForCredit.lines[1].label}` }],
    status: "validee",
    authorId: "u-acc",
    validatedById: "u-dg",
    validatedAt: addDays(origForCredit.date, 2),
    originalInvoiceId: origForCredit.id,
    creditNoteIds: [],
    correctionReason: "Acte saisi par erreur (démonstration)",
    fiscalStatus: "non_concerne_demo",
    notes: "",
  };
  invoices.push(creditNote);
  origForCredit.creditNoteIds.push(creditNote.id);

  /* ---------------- Prescriptions ---------------- */
  const rx = (n: number, patient: Patient, productId: string, quantity: number, status: Prescription["status"], consultationId?: string): Prescription => ({
    id: `rx-${pad(n, 3)}`,
    code: `ORD-${pad(n)}`,
    patientId: patient.id,
    clientId: patient.ownerId,
    consultationId,
    productId,
    form: PRODUCTS.find((p) => p.id === productId)!.form,
    route: "Selon prescription",
    quantity,
    dose: "Dose saisie par le vétérinaire (champ libre — démo)",
    frequency: "Selon prescription",
    duration: "Selon prescription",
    instructions: "Consignes fictives de démonstration.",
    authorId: "u-vet1",
    vetId: "u-vet1",
    date: D(-n),
    status,
    validatedById: status === "brouillon" || status === "a_valider" ? undefined : "u-vet1",
    deliveries: [],
  });
  const prescriptions: Prescription[] = [
    rx(1, petPatients[3], "prd-01", 4, "validee", consultations[5].id),
    rx(2, petPatients[4], "prd-11", 3, "partiellement_delivree", consultations[6].id),
    rx(3, petPatients[5], "prd-12", 2, "delivree", consultations[7].id),
    rx(4, petPatients[2], "prd-23", 1, "brouillon", cToday1.id),
    rx(5, petPatients[6 + 1], "prd-04", 2, "validee", consultations[8].id),
    rx(6, petPatients[8], "prd-02", 1, "validee", consultations[9].id),
    rx(7, petPatients[10], "prd-05", 2, "a_valider", consultations[10].id),
  ];
  const deliver = (p: Prescription, qty: number, off: number) => {
    const lot = firstLot(p.productId)!;
    const mvId = movement(lot.id, "delivrance", -qty, DT(off, 11), "u-acc", `Délivrance ${p.code}`, { kind: "prescription", id: p.id });
    p.deliveries.push({ id: `dl-${p.id}-${p.deliveries.length + 1}`, date: DT(off, 11), qty, allocations: [{ lotId: lot.id, qty }], userId: "u-acc", movementIds: [mvId], opKey: `seed-dl-${p.id}-${p.deliveries.length}`, kind: "delivrance" });
  };
  deliver(prescriptions[1], 1, -2);
  deliver(prescriptions[2], 2, -3);

  /* ---------------- Hospitalisations ---------------- */
  const hospPatient1 = petPatients[14];
  const hospPatient2 = petPatients[15];
  const hospPatient3 = petPatients[16];
  const hospitalizations: Hospitalization[] = [
    {
      id: "hosp-001",
      code: "HOSP-0001",
      patientId: hospPatient1.id,
      clientId: hospPatient1.ownerId,
      establishmentId: "est-abj",
      admittedAt: DT(-2, 11),
      reason: "Surveillance post-opératoire (démo)",
      consent: { signed: true, signedBy: clients.find((c) => c.id === hospPatient1.ownerId)!.name, date: DT(-2, 11) },
      cage: "Box chien 1",
      quoteId: "quo-001",
      vetId: "u-vet1",
      carePlan: [
        { id: "cp-1", label: "Contrôle des paramètres", schedule: "Matin et soir", done: false },
        { id: "cp-2", label: "Soins de plaie", schedule: "1 fois / jour", done: true },
        { id: "cp-3", label: "Fluidothérapie selon prescription", schedule: "Continue", done: false },
      ],
      observations: [
        { id: "ob-1", date: DT(-2, 18), authorId: "u-vet1", text: "Réveil calme, paramètres saisis (fictif)." },
        { id: "ob-2", date: DT(-1, 9), authorId: "u-asst1", text: "A bu, appétit modéré (fictif)." },
      ],
      transmissions: [{ id: "tr-1", date: DT(-1, 19), authorId: "u-asst1", text: "RAS pour l'équipe de nuit (fictif).", shift: "Jour → Nuit" }],
      careActs: [],
      status: "en_cours",
      dailyRate: 12000,
    },
    {
      id: "hosp-002",
      code: "HOSP-0002",
      patientId: hospPatient2.id,
      clientId: hospPatient2.ownerId,
      establishmentId: "est-abj",
      admittedAt: DT(0, 8, 45),
      reason: "Déshydratation — mise sous surveillance (démo)",
      consent: { signed: false, signedBy: "" },
      cage: "Chatterie 1",
      vetId: "u-dg",
      carePlan: [{ id: "cp-4", label: "Réhydratation selon prescription", schedule: "Continue", done: false }],
      observations: [],
      transmissions: [],
      careActs: [],
      status: "en_cours",
      dailyRate: 10000,
    },
    {
      id: "hosp-003",
      code: "HOSP-0003",
      patientId: hospPatient3.id,
      clientId: hospPatient3.ownerId,
      establishmentId: "est-abj",
      admittedAt: DT(-9, 10),
      reason: "Hospitalisation de démonstration terminée",
      consent: { signed: true, signedBy: clients.find((c) => c.id === hospPatient3.ownerId)!.name, date: DT(-9, 10) },
      cage: "Box chien 2",
      vetId: "u-vet1",
      carePlan: [{ id: "cp-5", label: "Soins quotidiens", schedule: "1 fois / jour", done: true }],
      observations: [{ id: "ob-3", date: DT(-6, 9), authorId: "u-vet1", text: "Évolution favorable (fictif)." }],
      transmissions: [],
      careActs: [],
      status: "sortie_medicale",
      dischargedAt: DT(-5, 16),
      dischargeNotes: "Sortie médicale prononcée. Le solde financier reste à régler séparément.",
      followUp: { date: D(2), notes: "Appel de suivi post-sortie", done: false },
      dailyRate: 12000,
    },
  ];
  const lotSol = firstLot("prd-03")!;
  const mvCare = movement(lotSol.id, "administration", -2, DT(-2, 14), "u-asst1", "Soin hospitalisation HOSP-0001", { kind: "hospitalisation", id: "hosp-001" });
  hospitalizations[0].careActs.push(
    { id: "ca-1", date: DT(-2, 14), authorId: "u-asst1", label: "Pose de perfusion", productId: "prd-03", qty: 2, movementId: mvCare, billingLine: { label: "Soluté isotonique démo 500 ml", qty: 2, unitPrice: 2500, status: "provisoire" }, opKey: "seed-ca-1" },
    { id: "ca-2", date: DT(-1, 10), authorId: "u-vet1", label: "Soins de plaie", billingLine: { label: "Soins et pansement", qty: 1, unitPrice: 8000, status: "provisoire" }, opKey: "seed-ca-2" },
  );
  const hospInv = addInvoice(hospPatient3.ownerId, "est-abj", D(-5), [
    { id: "il-h1", label: "Hospitalisation (forfait journalier)", kind: "service", qty: 4, unitPrice: 12000, discountPct: 0, source: { kind: "hospitalisation", id: "hosp-003", label: "HOSP-0003" } },
    { id: "il-h2", label: "Soins quotidiens", kind: "service", qty: 4, unitPrice: 8000, discountPct: 0, source: { kind: "hospitalisation", id: "hosp-003", label: "HOSP-0003" } },
  ], 0.5);
  hospitalizations[2].invoiceId = hospInv.id;

  /* ---------------- Missions ---------------- */
  const missions: Mission[] = [];
  const mkMission = (n: number, farmIdx: number, off: number, status: Mission["status"], objective: string, interventions: string[]): Mission => {
    const farm = farms[farmIdx];
    return {
      id: `mis-${pad(n, 3)}`,
      code: `MIS-${pad(n)}`,
      objective,
      date: D(off),
      endDate: D(off),
      location: `${farm.name} — ${farm.location}`,
      establishmentId: farmIdx === 1 || farmIdx === 3 ? "est-yam" : "est-abj",
      leaderId: farmIdx === 1 || farmIdx === 3 ? "u-vet2" : "u-vet1",
      teamIds: farmIdx === 1 || farmIdx === 3 ? ["u-asst2"] : ["u-asst1"],
      farmIds: [farm.id],
      clientIds: [farm.clientId],
      plannedInterventions: interventions,
      interventionsDone: [],
      stock: [],
      observedHeadcounts: [],
      report: "",
      status,
    };
  };
  const m1 = mkMission(1, 0, -30, "terminee", "Campagne de vaccination aviaire (démo)", ["Vaccination de la bande 1-A", "Contrôle des effectifs"]);
  const m1Lot = firstLot("prd-09")!;
  const m1Out = movement(m1Lot.id, "mission_sortie", -3, DT(-30, 7), "u-vet1", "Transfert vers MIS-0001", { kind: "mission", id: m1.id });
  const m1Back = movement(m1Lot.id, "mission_retour", 1, DT(-30, 18), "u-vet1", "Retour MIS-0001", { kind: "mission", id: m1.id });
  void m1Back;
  m1.stock.push({ id: "ms-1", productId: "prd-09", lotId: m1Lot.id, transferred: 3, consumed: 2, delivered: 0, lost: 0, returned: 1, transferMovementId: m1Out, reconciled: true });
  m1.interventionsDone = ["Vaccination de la bande 1-A", "Contrôle des effectifs"];
  m1.observedHeadcounts = [{ farmId: farms[0].id, lotLabel: "Bande 1-A", count: 5880 }];
  m1.report = "Mission réalisée selon le plan (rapport fictif). 2 flacons utilisés, 1 flacon retourné.";
  m1.reconciledAt = D(-29);
  const m2 = mkMission(2, 1, 0, "en_cours", "Déparasitage et suivi du troupeau (démo)", ["Déparasitage bande 2-A", "Pesée échantillon", "Contrôle reproducteur"]);
  const m2LotA = firstLot("prd-13", "est-yam") ?? firstLot("prd-13")!;
  const m2LotB = firstLot("prd-05", "est-yam") ?? firstLot("prd-05")!;
  const m2a = movement(m2LotA.id, "mission_sortie", -Math.min(3, m2LotA.qtyAvailable), DT(0, 7), "u-vet2", "Transfert vers MIS-0002", { kind: "mission", id: m2.id });
  const m2b = movement(m2LotB.id, "mission_sortie", -Math.min(2, m2LotB.qtyAvailable), DT(0, 7), "u-vet2", "Transfert vers MIS-0002", { kind: "mission", id: m2.id });
  m2.stock.push(
    { id: "ms-2", productId: "prd-13", lotId: m2LotA.id, transferred: Math.min(3, m2LotA.qtyAvailable + 3), consumed: 0, delivered: 0, lost: 0, returned: 0, transferMovementId: m2a, reconciled: false },
    { id: "ms-3", productId: "prd-05", lotId: m2LotB.id, transferred: Math.min(2, m2LotB.qtyAvailable + 2), consumed: 0, delivered: 0, lost: 0, returned: 0, transferMovementId: m2b, reconciled: false },
  );
  m2.stock[0].transferred = -movements.find((x) => x.id === m2a)!.qty;
  m2.stock[1].transferred = -movements.find((x) => x.id === m2b)!.qty;
  missions.push(m1, m2);
  missions.push(mkMission(3, 3, 5, "planifiee", "Visite sanitaire de la bergerie (démo)", ["Examen du troupeau", "Prélèvements (simulés)"]));
  missions.push(mkMission(4, 2, 12, "brouillon", "Audit biosécurité porcherie (démo)", ["Audit des accès", "Formation du personnel"]));
  const misInv = addInvoice(farms[0].clientId, "est-abj", D(-29), [
    { id: "il-m1", label: "Intervention terrain — vaccination", kind: "service", qty: 1, unitPrice: 85000, discountPct: 0, source: { kind: "mission", id: m1.id, label: m1.code } },
    { id: "il-m2", label: "Vaccin Newcastle démo (1000 doses)", kind: "produit", productId: "prd-09", qty: 2, unitPrice: 12000, discountPct: 0, source: { kind: "mission", id: m1.id, label: m1.code } },
  ], 1);
  void misInv;

  /* ---------------- Achats ---------------- */
  const purchaseOrders: PurchaseOrder[] = [
    { id: "po-001", code: "BC-0001", supplierId: "sup-1", establishmentId: "est-abj", date: D(-35), expectedDate: D(-30), lines: [{ id: "pol-1", productId: "prd-01", qtyOrdered: 30, unitPrice: 180 }, { id: "pol-2", productId: "prd-02", qtyOrdered: 12, unitPrice: 4200 }], status: "recue", authorId: "u-acc", notes: "" },
    { id: "po-002", code: "BC-0002", supplierId: "sup-1", establishmentId: "est-abj", date: D(-3), expectedDate: D(2), lines: [{ id: "pol-3", productId: "prd-02", qtyOrdered: 10, unitPrice: 4200 }], status: "envoyee", authorId: "u-acc", notes: "Scénario de test : 10 flacons commandés." },
    { id: "po-003", code: "BC-0003", supplierId: "sup-3", establishmentId: "est-abj", date: D(-15), expectedDate: D(-8), lines: [{ id: "pol-4", productId: "prd-11", qtyOrdered: 60, unitPrice: 1900 }, { id: "pol-5", productId: "prd-12", qtyOrdered: 100, unitPrice: 350 }], status: "partiellement_recue", authorId: "u-acc", notes: "" },
    { id: "po-004", code: "BC-0004", supplierId: "sup-2", establishmentId: "est-abj", date: D(0), expectedDate: D(7), lines: [{ id: "pol-6", productId: "prd-06", qtyOrdered: 50, unitPrice: 1500 }], status: "brouillon", authorId: "u-acc", notes: "Réassort vaccins rage (stock faible)." },
    { id: "po-005", code: "BC-0005", supplierId: "sup-5", establishmentId: "est-yam", date: D(-50), expectedDate: D(-45), lines: [{ id: "pol-7", productId: "prd-18", qtyOrdered: 10, unitPrice: 18000 }], status: "annulee", authorId: "u-acc", notes: "Annulée — fournisseur en rupture (fictif)." },
  ];
  const po3Lot = mkLot("prd-11", "est-abj", 30, -8, 500, "disponible", "rec-002");
  const receptions: Reception[] = [
    { id: "rec-1", code: "REC-0001", poId: "po-001", supplierId: "sup-1", establishmentId: "est-abj", date: D(-30), source: "manuel", deliveryNoteRef: "BL-VP-88412", status: "validee", lines: [{ id: "rl-1", poLineId: "pol-1", productId: "prd-01", qtyOrdered: 30, qtyReceived: 30, lotRef: "LOT-A1", expiryDate: D(500), unitCost: 180 }, { id: "rl-2", poLineId: "pol-2", productId: "prd-02", qtyOrdered: 12, qtyReceived: 12, lotRef: "LOT-A2", expiryDate: D(200), unitCost: 4200 }], authorId: "u-acc", validatedById: "u-dg", validatedAt: D(-30) },
    { id: "rec-002", code: "REC-0002", poId: "po-003", supplierId: "sup-3", establishmentId: "est-abj", date: D(-8), source: "manuel", deliveryNoteRef: "BL-MA-1203", status: "validee", lines: [{ id: "rl-3", poLineId: "pol-4", productId: "prd-11", qtyOrdered: 60, qtyReceived: 30, lotRef: lots.find((l) => l.id === po3Lot)!.ref, expiryDate: D(500), unitCost: 1900 }, { id: "rl-4", poLineId: "pol-5", productId: "prd-12", qtyOrdered: 100, qtyReceived: 0, lotRef: "", expiryDate: D(400), unitCost: 350 }], authorId: "u-acc", validatedById: "u-dg", validatedAt: D(-8) },
    { id: "rec-003", code: "REC-0003", supplierId: "sup-4", establishmentId: "est-abj", date: D(0), source: "bli_edi", deliveryNoteRef: "BLI-LC-2026-0457", status: "proposee", lines: [{ id: "rl-5", productId: "prd-14", qtyOrdered: 200, qtyReceived: 200, lotRef: "LC-SR-0457", expiryDate: D(900), unitCost: 60 }, { id: "rl-6", productId: "prd-16", qtyOrdered: 50, qtyReceived: 50, lotRef: "LC-CP-0457", expiryDate: D(700), unitCost: 400 }], authorId: "u-acc" },
  ];

  /* ---------------- Devis ---------------- */
  const quotes: Quote[] = [
    { id: "quo-001", code: `${SETTINGS.quotePrefix}-0001`, clientId: hospPatient1.ownerId, patientId: hospPatient1.id, establishmentId: "est-abj", date: D(-3), validUntil: D(27), lines: [{ id: "ql-1", label: "Chirurgie (forfait démo)", kind: "service", qty: 1, unitPrice: 95000, discountPct: 0 }, { id: "ql-2", label: "Hospitalisation (forfait journalier)", kind: "service", qty: 3, unitPrice: 12000, discountPct: 0 }], status: "accepte", authorId: "u-vet1", notes: "Devis accepté avant admission." },
    { id: "quo-002", code: `${SETTINGS.quotePrefix}-0002`, clientId: cli(11), establishmentId: "est-abj", date: D(-1), validUntil: D(29), lines: [{ id: "ql-3", label: "Détartrage (démo)", kind: "service", qty: 1, unitPrice: 45000, discountPct: 0 }, { id: "ql-4", label: "Bilan pré-anesthésique (démo)", kind: "service", qty: 1, unitPrice: 25000, discountPct: 0 }], status: "accepte", authorId: "u-vet1", notes: "Scénario de test : à convertir en facture." },
    { id: "quo-003", code: `${SETTINGS.quotePrefix}-0003`, clientId: farms[2].clientId, establishmentId: "est-abj", date: D(0), validUntil: D(30), lines: [{ id: "ql-5", label: "Audit biosécurité (démo)", kind: "service", qty: 1, unitPrice: 150000, discountPct: 0 }], status: "brouillon", authorId: "u-dg", notes: "" },
    { id: "quo-004", code: `${SETTINGS.quotePrefix}-0004`, clientId: cli(2), establishmentId: "est-abj", date: D(-20), validUntil: D(10), lines: [{ id: "ql-6", label: "Stérilisation (forfait démo)", kind: "service", qty: 1, unitPrice: 60000, discountPct: 0 }], status: "envoye", authorId: "u-vet1", notes: "" },
  ];

  /* ---------------- Finances ---------------- */
  const expenses: Expense[] = [];
  let exN = 0;
  const addExpense = (off: number, accountId: string, category: string, label: string, amount: number, extra: Partial<Expense> = {}) => {
    exN++;
    expenses.push({ id: `exp-${pad(exN, 3)}`, code: `DEP-${pad(exN)}`, date: D(off), accountId, category, label, amount, status: "approuvee", requestedById: "u-acc", decidedById: "u-dg", decidedAt: D(off), withinDelegation: amount <= SETTINGS.expenseDelegationAmount, ...extra });
  };
  for (let mth = 0; mth < 6; mth++) {
    const base = -mth * 30 - 3;
    addExpense(base, "acc-banque", "Loyer", "Loyer clinique (fictif)", 150000);
    addExpense(base - 2, "acc-banque", "Électricité / eau", "Facture énergie (fictive)", int(45000, 70000));
    addExpense(base - 5, "acc-caisse-abj", "Carburant", "Carburant véhicules", int(20000, 45000));
    addExpense(base - 8, "acc-banque", "Achats stock", "Règlement fournisseur (fictif)", int(120000, 300000));
    addExpense(base - 10, "acc-banque", "Salaires", "Masse salariale (confidentiel)", 1600000, { confidential: true });
    if (mth % 2 === 0) addExpense(base - 12, "acc-caisse-abj", "Fournitures", "Fournitures de bureau", int(15000, 40000));
  }
  addExpense(-1, "acc-caisse-abj", "Maintenance", "Réparation climatisation salle 2 (hors délégation)", 180000, { status: "en_attente", decidedById: undefined, decidedAt: undefined, withinDelegation: false });
  const accountTransfers = [0, 1, 2, 3].map((k) => ({ id: `trf-${k + 1}`, code: `VIR-${pad(k + 1)}`, date: D(-k * 30 - 5), fromAccountId: "acc-caisse-abj", toAccountId: "acc-banque", amount: 400000, fees: 0, userId: "u-dg", note: "Dépôt d'espèces en banque (simulé)" }));
  accountTransfers.push({ id: "trf-5", code: "VIR-0005", date: D(-7), fromAccountId: "acc-om", toAccountId: "acc-banque", amount: 150000, fees: 1500, userId: "u-dg", note: "Reversement Mobile Money (simulé)" });
  const closings = [3, 2, 1].map((k) => ({ id: `clo-${k}`, date: D(-k), accountId: "acc-caisse-abj", expected: 180000 + k * 15000, counted: 180000 + k * 15000 - (k === 2 ? 500 : 0), userId: "u-acc", note: k === 2 ? "Écart de 500 F constaté (démo)" : "Clôture journalière (démo)" }));
  const credits = [
    { id: "cr-001", code: "CRD-0001", clientId: farms[2].clientId, ceiling: 500000, dueDate: D(45), reason: "Achat groupé de vaccins avant campagne (démo)", requestedById: "u-acc", date: D(-1), status: "en_attente" as const, history: [{ date: DT(-1, 15), userId: "u-acc", action: "Demande de crédit créée" }] },
    { id: "cr-002", code: "CRD-0002", clientId: farms[0].clientId, ceiling: 750000, dueDate: D(20), reason: "Facilité de paiement pour client éleveur fidèle (démo)", requestedById: "u-vet1", date: D(-40), status: "approuve" as const, decidedById: "u-dg", decidedAt: D(-39), decisionNote: "Accordé — échéance stricte.", history: [{ date: DT(-40, 9), userId: "u-vet1", action: "Demande de crédit créée" }, { date: DT(-39, 11), userId: "u-dg", action: "Crédit approuvé", note: "Accordé — échéance stricte." }] },
  ];
  const openingReceivables = [
    { id: "or-001", code: "SOI-0001", clientId: cli(4), label: "Solde antérieur au démarrage du logiciel (fictif)", amount: 45000, originDate: "2025-11-15" },
    { id: "or-002", code: "SOI-0002", clientId: farms[1].clientId, label: "Créance ancienne — campagne 2025 (fictive)", amount: 320000, originDate: "2025-09-30" },
    { id: "or-003", code: "SOI-0003", clientId: cli(5), label: "Créance ancienne liée à l'animal cédé (fictive)", amount: 28000, originDate: "2025-12-20" },
  ];
  payN++;
  payments.push({ id: `pay-${pad(payN, 3)}`, code: `DEMO-ENC-${pad(payN)}`, date: D(-10), clientId: farms[1].clientId, amount: 120000, method: "virement", accountId: "acc-banque", kind: "ancienne_creance", allocations: [{ receivableId: "or-002", amount: 120000 }], reference: "VIR-SIM-5512", userId: "u-acc", opKey: "seed-or-pay", note: "Règlement partiel d'une créance antérieure — date réelle du paiement conservée." });
  const salaries = USERS.filter((x) => x.active && x.roleId !== "confrere" && x.roleId !== "comptable").flatMap((x) =>
    [1, 2, 3].map((k) => {
      const d = new Date(now);
      d.setMonth(d.getMonth() - k);
      const gross = x.roleId === "dg" ? 450000 : x.roleId === "vet" ? 350000 : 150000;
      return { id: `sal-${x.id}-${k}`, userId: x.id, month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, gross, net: Math.round(gross * 0.82) };
    }),
  );

  /* ---------------- Relation client ---------------- */
  const tasks: Task[] = [];
  let tN = 0;
  const addTask = (title: string, category: Task["category"], assigneeId: string, dueOff: number, status: Task["status"], priority: Task["priority"], clientId?: string, patientId?: string) => {
    tN++;
    tasks.push({ id: `tsk-${pad(tN, 3)}`, title, description: `${title} — tâche fictive de démonstration.`, assigneeId, priority, dueDate: D(dueOff), status, category, clientId, patientId, result: status === "termine" ? "Réalisé (fictif)" : "", history: [{ date: DT(dueOff - 5, 9), userId: "u-dg", action: "Tâche créée" }] });
  };
  addTask("Rappeler le client pour le contrôle", "suivi_consultation", "u-acc", -2, "a_faire", "haute", petPatients[3].ownerId, petPatients[3].id);
  addTask("Relancer facture en retard", "impaye", "u-acc", -5, "en_cours", "urgente", invoices.find((i) => i.dueDate < today && i.status === "validee")?.clientId ?? cli(6));
  addTask("Appel de suivi post-hospitalisation", "suivi_hospitalisation", "u-asst1", 2, "a_faire", "normale", hospPatient3.ownerId, hospPatient3.id);
  addTask("Préparer le rappel vaccinal", "rappel", "u-acc", 3, "a_faire", "normale", petPatients[5].ownerId, petPatients[5].id);
  addTask("Contacter client inactif", "relance_inactif", "u-acc", 7, "a_faire", "basse", cli(17));
  addTask("Vérifier les péremptions du réfrigérateur", "administratif", "u-asst1", -1, "a_faire", "haute");
  addTask("Compléter le dossier d'identification", "suivi_consultation", "u-vet1", 1, "en_attente", "normale", petPatients[6].ownerId, petPatients[6].id);
  addTask("Envoyer le compte rendu au confrère", "suivi_consultation", "u-vet1", -3, "termine", "normale", patients[0].ownerId, patients[0].id);
  addTask("Préparer la mission de la bergerie", "administratif", "u-vet2", 4, "en_cours", "haute");
  addTask("Relancer la créance ancienne", "impaye", "u-acc", 10, "a_faire", "normale", cli(4));
  addTask("Inventaire mensuel de la pharmacie", "administratif", "u-acc", 0, "a_faire", "haute");
  addTask("Rappel de rendez-vous de demain", "rappel", "u-acc", 0, "a_faire", "normale", petPatients[20]?.ownerId);
  const interactions: Interaction[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => ({
    id: `int-${k + 1}`,
    clientId: cli((k % 22) + 1),
    date: DT(-k * 3 - 1, 10 + (k % 6)),
    channel: (["appel", "sms", "whatsapp", "email", "visite"] as const)[k % 5],
    summary: ["Appel entrant — prise de rendez-vous", "Rappel de rendez-vous (simulé, non envoyé)", "Échange au sujet du suivi (simulé)", "Envoi de facture (simulé, non envoyé)", "Passage à la clinique"][k % 5],
    userId: "u-acc",
    simulated: k % 5 === 1 || k % 5 === 2 || k % 5 === 3,
  }));

  /* ---------------- Formations ---------------- */
  const mkParticipants = (n: number, sessionId: string, dates: string[]) =>
    Array.from({ length: n }, (_, k) => ({
      id: `${sessionId}-p${k + 1}`,
      name: ["Kouamé Aristide", "Yao Florence", "Traoré Ali", "Ehouman Grâce", "Coulibaly Issa", "Gnagne Paul", "Kassi Rose", "Bamba Lamine"][k % 8],
      phone: `07 50 60 70 ${pad(k + 10, 2)}`,
      payerClientId: FARM_CLIENTS[k % FARM_CLIENTS.length],
      registeredAt: D(-10 - k),
      attendance: Object.fromEntries(dates.map((d) => [d, r() < 0.85])),
    }));
  const sessions: TrainingSession[] = [
    { id: "ses-001", code: "SES-0001", trainingId: "trn-1", title: "Biosécurité en élevage avicole — Session de novembre", description: TRAININGS[0].description, startDate: D(10), endDate: D(11), location: "Salle de formation BIRCOVET Cocody", modality: "presentiel", capacity: 6, trainers: ["Dr Aya Kouassi", "Dr Fatou Traoré"], participants: mkParticipants(5, "ses-001", []), status: "ouverte", price: 75000, history: [{ date: D(-20), userId: "u-dg", action: "Session créée" }] },
    { id: "ses-002", code: "SES-0002", trainingId: "trn-3", title: "Gestion d'une pharmacie vétérinaire", description: TRAININGS[2].description, startDate: D(-20), endDate: D(-20), location: "Yamoussoukro", modality: "presentiel", capacity: 10, trainers: ["Dr Yao N'Guessan"], participants: mkParticipants(7, "ses-002", [D(-20)]), status: "terminee", price: 50000, history: [{ date: D(-40), userId: "u-dg", action: "Session créée" }] },
    { id: "ses-003", code: "SES-0003", trainingId: "trn-2", title: "Premiers soins canins — en ligne", description: TRAININGS[1].description, startDate: D(30), endDate: D(30), location: "Classe virtuelle (lien fourni après intégration)", modality: "distanciel", capacity: 20, trainers: ["Dr Yao N'Guessan"], participants: mkParticipants(3, "ses-003", []), status: "planifiee", price: 35000, history: [{ date: D(-5), userId: "u-dg", action: "Session créée" }] },
  ];
  // Facture formation terminée (via module financier commun)
  const trInv = addInvoice(FARM_CLIENTS[0], "est-yam", D(-19), [{ id: "il-t1", label: "Formation : Gestion d'une pharmacie vétérinaire (2 participants)", kind: "service", qty: 2, unitPrice: 50000, discountPct: 0, source: { kind: "formation", id: "ses-002", label: "SES-0002" } }], 1);
  sessions[1].participants.filter((p) => p.payerClientId === FARM_CLIENTS[0]).forEach((p) => (p.invoiceId = trInv.id));

  /* ---------------- Documents ---------------- */
  const docs: DocumentItem[] = [];
  const addDoc = (title: string, category: DocumentItem["category"], linked: DocumentItem["linked"], off: number, authorId: string, content: string, mimeType = "text/plain") => {
    docs.push({ id: `doc-${pad(docs.length + 1, 3)}`, title, category, linked, authorId, date: D(off), version: 1, status: "actif", fileName: `${title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")}.txt`, mimeType, size: content.length * 2, contentText: content });
  };
  addDoc("Compte rendu de consultation", "compte_rendu", { kind: "patient", id: patients[0].id }, -20, "u-vet1", `COMPTE RENDU (FICTIF)\nPatient : ${patients[0].name}\nMotif : contrôle\nConclusion : document de démonstration sans valeur médicale.`);
  addDoc("Analyse sanguine — résultats", "analyse", { kind: "patient", id: patients[3].id }, -15, "u-vet1", `RÉSULTATS D'ANALYSE (FICTIFS)\nPatient : ${patients[3].name}\nHématocrite : valeur fictive\nCommentaire : exemple d'interface uniquement.`);
  addDoc("Radiographie thoracique (illustrative)", "radiographie", { kind: "patient", id: patients[3].id }, -15, "u-dg", "Image radiographique illustrative — aucune donnée réelle. Le fichier image sera stocké côté serveur après intégration.", "image/svg+xml");
  addDoc("Consentement d'hospitalisation", "consentement", { kind: "hospitalisation", id: "hosp-001" }, -2, "u-acc", "CONSENTEMENT ÉCLAIRÉ (MODÈLE FICTIF)\nLe propriétaire déclare avoir été informé… (texte de démonstration).");
  addDoc("Rapport de mission MIS-0001", "rapport", { kind: "mission", id: "mis-001" }, -29, "u-vet1", "RAPPORT DE MISSION (FICTIF)\nInterventions : vaccination bande 1-A.\nConsommations : 2 flacons ; retour : 1 flacon.");
  addDoc("Rapport de visite — Ranch Konan", "rapport", { kind: "exploitation", id: "farm-2" }, -12, "u-vet2", "RAPPORT DE VISITE (FICTIF)\nEffectifs contrôlés. Aucune anomalie administrative relevée.");
  addDoc("Fiche client — pièce d'identité (exemple)", "administratif", { kind: "client", id: cli(1) }, -100, "u-acc", "Exemple de pièce administrative — aucune donnée personnelle réelle.");
  addDoc("Ordonnance ORD-0001", "ordonnance", { kind: "consultation", id: consultations[5].id }, -1, "u-vet1", "ORDONNANCE (FICTIVE)\nProduit : Amoxicilline démo 250 mg\nPosologie : saisie par le vétérinaire.");
  addDoc("Compte rendu d'hospitalisation HOSP-0003", "compte_rendu", { kind: "hospitalisation", id: "hosp-003" }, -5, "u-vet1", "COMPTE RENDU DE SORTIE (FICTIF)\nSortie médicale prononcée. Suivi programmé.");
  addDoc("Analyse coproscopique (exemple)", "analyse", { kind: "exploitation", id: "farm-4" }, -40, "u-vet2", "RÉSULTATS (FICTIFS) — échantillons de démonstration.");
  addDoc("Procédure interne — chaîne du froid", "administratif", { kind: "autre", id: "clinique" }, -200, "u-dg", "PROCÉDURE INTERNE (EXEMPLE)\nContrôle quotidien de la température du réfrigérateur à vaccins.");

  /* ---------------- Journal & notifications ---------------- */
  const audit: AuditEntry[] = [
    { id: "aud-1", date: DT(-39, 11), userId: "u-dg", module: "Finances", action: "Approbation de crédit", target: "CRD-0002", oldValue: "En attente DG", newValue: "Approuvé", reason: "Accordé — échéance stricte.", decision: "Approuvé" },
    { id: "aud-2", date: DT(-30, 16), userId: "u-dg", module: "Achats", action: "Validation de réception", target: "REC-0001", newValue: "42 unités entrées en stock" },
    { id: "aud-3", date: DT(-45, 10), userId: "u-dg", module: "Patients", action: "Déclaration de décès", target: patients[6].code, oldValue: "Vivant", newValue: "Décédé", reason: "Décès constaté (donnée fictive)" },
    { id: "aud-4", date: DT(-60, 9), userId: "u-dg", module: "Administration", action: "Désactivation d'utilisateur", target: "Paul Gnamien", oldValue: "Actif", newValue: "Désactivé", reason: "Fin de contrat (fictif) — historique conservé" },
    { id: "aud-5", date: DT(-5, 16), userId: "u-vet1", module: "Hospitalisation", action: "Sortie médicale", target: "HOSP-0003", newValue: "Sortie médicale", reason: "Solde financier distinct" },
  ];
  const notifications = [
    { id: "ntf-1", date: DT(0, 8), title: "Stock faible", body: "Vaccin rage démo sous le seuil d'alerte.", level: "alerte" as const, read: false, link: "/stock/alertes" },
    { id: "ntf-2", date: DT(0, 8), title: "Lots proches de la péremption", body: "Des lots arrivent à péremption dans moins de 30 jours.", level: "alerte" as const, read: false, link: "/stock/alertes" },
    { id: "ntf-3", date: DT(-1, 15), title: "Crédit en attente DG", body: "CRD-0001 demande une décision du DG.", level: "info" as const, read: false, link: "/finances/credits" },
    { id: "ntf-4", date: DT(-1, 17), title: "Dépense hors délégation", body: "DEP en attente de validation DG.", level: "info" as const, read: true, link: "/finances/depenses" },
    { id: "ntf-5", date: DT(0, 7), title: "Réception BLI proposée", body: "REC-0003 importée — à contrôler avant entrée en stock.", level: "info" as const, read: false, link: "/achats/receptions" },
  ];

  return {
    schemaVersion: SCHEMA_VERSION,
    seededAt: isoLocal(now),
    users: USERS.map((x) => ({ ...x })),
    establishments: ESTABLISHMENTS.map((x) => ({ ...x })),
    clients,
    patients,
    farms,
    appointments,
    unavailabilities,
    consultations,
    prescriptions,
    hospitalizations,
    missions,
    products: PRODUCTS.map((x) => ({ ...x })),
    lots,
    movements,
    corrections: [
      { id: "cor-001", date: D(-1), lotId: lots.find((l) => l.productId === "prd-16")!.id, productId: "prd-16", qtyDelta: -2, reason: "Paquets endommagés (humidité) — démo", kind: "perte", requestedById: "u-asst1", status: "proposee" },
    ],
    inventories: [],
    stockTransfers: [],
    suppliers: SUPPLIERS.map((x) => ({ ...x })),
    purchaseOrders,
    receptions,
    quotes,
    invoices,
    payments,
    accounts: ACCOUNTS.map((x) => ({ ...x })),
    expenses,
    accountTransfers,
    closings,
    credits,
    openingReceivables,
    salaries,
    tasks,
    templates: TEMPLATES.map((x) => ({ ...x })),
    interactions,
    trainings: TRAININGS.map((x) => ({ ...x })),
    sessions,
    documents: docs,
    audit,
    notifications,
    syncQueue: [],
    aiConversations: [
      {
        id: "ai-1",
        title: "Exemple : anomalies administratives",
        date: DT(-1, 11),
        messages: [
          { id: "aim-1", role: "user", content: "Signale les anomalies administratives de la semaine.", date: DT(-1, 11) },
          { id: "aim-2", role: "assistant", content: "Brouillon à vérifier — 3 points relevés dans les données fictives : factures en retard, réception proposée non validée, consultation en attente de validation.", date: DT(-1, 11, 1), scenario: "anomalies", draftStatus: "rejete" },
        ],
      },
    ],
    settings: { ...SETTINGS },
    counters: {
      client: clients.length,
      patient: patients.length,
      farm: farms.length,
      appointment: apN,
      consultation: coN,
      prescription: prescriptions.length,
      hospitalization: hospitalizations.length,
      mission: missions.length,
      invoice: invN,
      creditNote: 1,
      quote: quotes.length,
      payment: payN,
      expense: exN,
      transfer: accountTransfers.length,
      credit: credits.length,
      po: purchaseOrders.length,
      reception: receptions.length,
      inventory: 0,
      stockTransfer: 0,
      session: sessions.length,
      receivable: openingReceivables.length,
      product: PRODUCTS.length,
      supplier: SUPPLIERS.length,
      lot: lotN,
    },
  };
}
