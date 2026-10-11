/** Données de référence fictives (utilisateurs, établissements, catalogue…). */
import type {
  Account,
  Establishment,
  MessageTemplate,
  Product,
  Settings,
  Supplier,
  Training,
  User,
} from "../types";

export const DEMO_PASSWORD = "Demo@2026";

export const ESTABLISHMENTS: Establishment[] = [
  {
    id: "est-abj",
    name: "BIRCOVET Abidjan — Cocody",
    city: "Abidjan",
    address: "Rue des Jardins, Cocody Riviera 2 (adresse fictive)",
    phone: "+225 27 22 00 00 01",
    email: "cocody@bircovet.demo",
    slotMinutes: 30,
    openingHours: "Lun–Sam 08:00–18:30",
    active: true,
    resources: ["Salle de consultation 1", "Salle de consultation 2", "Bloc opératoire", "Salle d'imagerie"],
    locations: ["Pharmacie — Armoire A", "Pharmacie — Armoire B", "Réfrigérateur vaccins", "Réserve"],
    cages: ["Box chien 1", "Box chien 2", "Box chien 3", "Chatterie 1", "Chatterie 2", "Isolement"],
  },
  {
    id: "est-yam",
    name: "BIRCOVET Yamoussoukro",
    city: "Yamoussoukro",
    address: "Quartier Habitat, Yamoussoukro (adresse fictive)",
    phone: "+225 27 30 00 00 02",
    email: "yamoussoukro@bircovet.demo",
    slotMinutes: 20,
    openingHours: "Lun–Ven 08:00–17:30",
    active: true,
    resources: ["Salle de consultation", "Salle de soins"],
    locations: ["Pharmacie", "Réfrigérateur", "Véhicule mission"],
    cages: ["Box 1", "Box 2"],
  },
  {
    id: "est-bke",
    name: "BIRCOVET Bouaké — Antenne terrain",
    city: "Bouaké",
    address: "Zone industrielle, Bouaké (adresse fictive)",
    phone: "+225 27 31 00 00 03",
    email: "bouake@bircovet.demo",
    slotMinutes: 45,
    openingHours: "Mar–Sam 08:00–16:00",
    active: true,
    resources: ["Salle polyvalente"],
    locations: ["Magasin terrain"],
    cages: [],
  },
];

const u = (
  id: string,
  name: string,
  email: string,
  roleId: User["roleId"],
  establishmentId: string,
  title: string,
  phone: string,
  extra: Partial<User> = {},
): User => ({
  id,
  name,
  email,
  roleId,
  establishmentId,
  title,
  phone,
  active: true,
  createdAt: "2025-01-06",
  demoPassword: DEMO_PASSWORD,
  ...extra,
});

export const USERS: User[] = [
  u("u-dg", "Dr Aya Kouassi", "dg@bircovet.demo", "dg", "est-abj", "Directrice générale, Docteur vétérinaire", "+225 07 00 00 10 01"),
  u("u-vet1", "Dr Yao N'Guessan", "vet@bircovet.demo", "vet", "est-abj", "Vétérinaire praticien", "+225 07 00 00 10 02"),
  u("u-vet2", "Dr Fatou Traoré", "vet2@bircovet.demo", "vet", "est-yam", "Vétérinaire — productions animales", "+225 07 00 00 10 03"),
  u("u-asst1", "Koffi Bamba", "assistant@bircovet.demo", "assistant", "est-abj", "Assistant technique vétérinaire", "+225 07 00 00 10 04"),
  u("u-asst2", "Mariam Ouattara", "assistant2@bircovet.demo", "assistant", "est-yam", "Assistante technique terrain", "+225 07 00 00 10 05"),
  u("u-acc", "Adjoua Yao", "accueil@bircovet.demo", "accueil", "est-abj", "Chargée d'accueil et de stock", "+225 07 00 00 10 06"),
  u("u-cpt", "Serge Akissi", "comptable@bircovet.demo", "comptable", "est-abj", "Consultant comptable externe", "+225 07 00 00 10 07"),
  u("u-conf", "Dr Ibrahim Diallo", "confrere@bircovet.demo", "confrere", "est-abj", "Confrère référent (cabinet externe fictif)", "+225 07 00 00 10 08", {
    sharedPatientIds: ["pat-001", "pat-004"],
  }),
  u("u-old", "Paul Gnamien", "ancien.assistant@bircovet.demo", "assistant", "est-abj", "Ancien assistant (compte désactivé)", "+225 07 00 00 10 09", {
    active: false,
  }),
];

export const SUPPLIERS: Supplier[] = [
  { id: "sup-1", code: "FRN-001", name: "VetoPharma Abidjan (fictif)", contactName: "M. Kadio", phone: "+225 27 21 11 11 11", email: "commandes@vetopharma.demo", address: "Zone 4, Marcory", category: "Médicaments", paymentTerms: "30 jours fin de mois", status: "actif" },
  { id: "sup-2", code: "FRN-002", name: "AgroSanté Distribution (fictif)", contactName: "Mme Assi", phone: "+225 27 21 22 22 22", email: "ventes@agrosante.demo", address: "Yopougon industriel", category: "Vaccins et biologiques", paymentTerms: "Comptant", status: "actif" },
  { id: "sup-3", code: "FRN-003", name: "MediAnimal CI (fictif)", contactName: "M. Coulibaly", phone: "+225 27 21 33 33 33", email: "contact@medianimal.demo", address: "Treichville", category: "Antiparasitaires", paymentTerms: "45 jours", status: "actif" },
  { id: "sup-4", code: "FRN-004", name: "Lagune Consommables (fictif)", contactName: "Mme Brou", phone: "+225 27 21 44 44 44", email: "info@lagune-conso.demo", address: "Port-Bouët", category: "Consommables", paymentTerms: "30 jours", status: "actif" },
  { id: "sup-5", code: "FRN-005", name: "Provende du Centre (fictif)", contactName: "M. Konan", phone: "+225 27 30 55 55 55", email: "provende@centre.demo", address: "Yamoussoukro", category: "Aliments", paymentTerms: "Comptant", status: "actif" },
  { id: "sup-6", code: "FRN-006", name: "BioLab Ouest (fictif)", contactName: "Dr Kra", phone: "+225 27 21 66 66 66", email: "labo@biolab.demo", address: "Plateau", category: "Matériel", paymentTerms: "60 jours", status: "inactif" },
];

const p = (
  id: string,
  code: string,
  name: string,
  category: Product["category"],
  form: string,
  units: [string, string, string, number],
  threshold: number,
  purchase: number,
  sale: number,
  supplierId: string,
  description: string,
): Product => ({
  id,
  code,
  name,
  category,
  form,
  purchaseUnit: units[0],
  stockUnit: units[1],
  saleUnit: units[2],
  conversion: units[3],
  alertThreshold: threshold,
  purchasePrice: purchase,
  salePrice: sale,
  supplierId,
  status: "actif",
  description,
});

/** Catalogue fictif — noms génériques de démonstration, sans posologie. */
export const PRODUCTS: Product[] = [
  p("prd-01", "MED-001", "Amoxicilline démo 250 mg", "medicament", "Comprimé", ["Boîte de 10 plaquettes", "Plaquette", "Plaquette", 10], 15, 1800, 3500, "sup-1", "Antibiotique — article fictif de démonstration."),
  p("prd-02", "MED-002", "Méloxicam démo suspension", "medicament", "Suspension buvable", ["Carton de 12", "Flacon", "Flacon", 12], 8, 4200, 7500, "sup-1", "Anti-inflammatoire — article fictif."),
  p("prd-03", "MED-003", "Soluté isotonique démo 500 ml", "medicament", "Solution injectable", ["Carton de 20", "Poche", "Poche", 20], 20, 900, 2500, "sup-4", "Fluidothérapie — article fictif."),
  p("prd-04", "MED-004", "Oxytétracycline démo injectable", "medicament", "Solution injectable", ["Carton de 10", "Flacon", "Flacon", 10], 10, 3500, 6000, "sup-1", "Article fictif destiné aux tests."),
  p("prd-05", "MED-005", "Vitamines B démo injectables", "medicament", "Solution injectable", ["Carton de 10", "Flacon", "Flacon", 10], 6, 2500, 4500, "sup-1", "Complément — article fictif."),
  p("prd-06", "VAC-001", "Vaccin rage démo", "vaccin", "Suspension injectable", ["Boîte de 10 doses", "Dose", "Dose", 10], 20, 1500, 6000, "sup-2", "Vaccin fictif — conservation au froid."),
  p("prd-07", "VAC-002", "Vaccin CHPPiL démo", "vaccin", "Lyophilisat", ["Boîte de 10 doses", "Dose", "Dose", 10], 15, 2500, 9000, "sup-2", "Vaccin canin fictif."),
  p("prd-08", "VAC-003", "Vaccin typhus-coryza démo", "vaccin", "Lyophilisat", ["Boîte de 10 doses", "Dose", "Dose", 10], 10, 2300, 8500, "sup-2", "Vaccin félin fictif."),
  p("prd-09", "VAC-004", "Vaccin Newcastle démo (1000 doses)", "vaccin", "Lyophilisat", ["Carton de 10 flacons", "Flacon", "Flacon", 10], 8, 6500, 12000, "sup-2", "Vaccin aviaire fictif, flacon multidoses."),
  p("prd-10", "VAC-005", "Vaccin Gumboro démo (1000 doses)", "vaccin", "Lyophilisat", ["Carton de 10 flacons", "Flacon", "Flacon", 10], 8, 7000, 13000, "sup-2", "Vaccin aviaire fictif."),
  p("prd-11", "APR-001", "Pipette antiparasitaire démo chien", "antiparasitaire", "Pipette", ["Boîte de 30", "Pipette", "Pipette", 30], 25, 1900, 4500, "sup-3", "Antiparasitaire externe fictif."),
  p("prd-12", "APR-002", "Vermifuge démo comprimé", "antiparasitaire", "Comprimé", ["Boîte de 50", "Comprimé", "Comprimé", 50], 40, 350, 1000, "sup-3", "Antiparasitaire interne fictif."),
  p("prd-13", "APR-003", "Ivermectine démo injectable 50 ml", "antiparasitaire", "Solution injectable", ["Carton de 12", "Flacon", "Flacon", 12], 6, 5200, 9500, "sup-3", "Article fictif pour élevage."),
  p("prd-14", "CON-001", "Seringue 5 ml", "consommable", "Unité", ["Carton de 100", "Unité", "Unité", 100], 100, 60, 200, "sup-4", "Seringue stérile à usage unique."),
  p("prd-15", "CON-002", "Gants d'examen (boîte de 100)", "consommable", "Boîte", ["Carton de 10", "Boîte", "Boîte", 10], 5, 3500, 6000, "sup-4", "Gants nitrile."),
  p("prd-16", "CON-003", "Compresses stériles (paquet)", "consommable", "Paquet", ["Carton de 50", "Paquet", "Paquet", 50], 30, 400, 1000, "sup-4", "Compresses 10x10."),
  p("prd-17", "CON-004", "Cathéter IV 22G", "consommable", "Unité", ["Boîte de 50", "Unité", "Unité", 50], 25, 450, 1500, "sup-4", "Cathéter intraveineux."),
  p("prd-18", "ALI-001", "Aliment chien adulte démo 15 kg", "aliment", "Sac", ["Palette de 20", "Sac", "Sac", 20], 4, 18000, 27000, "sup-5", "Aliment sec fictif."),
  p("prd-19", "ALI-002", "Aliment chat démo 2 kg", "aliment", "Sac", ["Carton de 6", "Sac", "Sac", 6], 6, 5500, 9000, "sup-5", "Aliment sec fictif."),
  p("prd-20", "ALI-003", "Complément volaille démo 1 kg", "aliment", "Sachet", ["Carton de 20", "Sachet", "Sachet", 20], 10, 1500, 3000, "sup-5", "Prémix fictif."),
  p("prd-21", "MAT-001", "Collerette de protection M", "materiel", "Unité", ["Lot de 10", "Unité", "Unité", 10], 5, 1200, 3500, "sup-4", "Collerette souple."),
  p("prd-22", "MED-006", "Désinfectant cutané démo 1 L", "medicament", "Solution", ["Carton de 12", "Flacon", "Flacon", 12], 4, 3000, 5500, "sup-4", "Antiseptique fictif."),
  p("prd-23", "MED-007", "Collyre démo 10 ml", "medicament", "Collyre", ["Boîte de 10", "Flacon", "Flacon", 10], 5, 2100, 4500, "sup-1", "Article fictif."),
  p("prd-24", "MED-008", "Anesthésique démo (usage clinique)", "medicament", "Solution injectable", ["Boîte de 5", "Flacon", "Flacon", 5], 3, 9500, 0, "sup-1", "Usage interne clinique uniquement — non vendu."),
];

export const ACCOUNTS: Account[] = [
  { id: "acc-caisse-abj", name: "Caisse Cocody", type: "caisse", establishmentId: "est-abj", openingBalance: 250000, openingDate: "2026-01-01", provider: "Espèces" },
  { id: "acc-caisse-yam", name: "Caisse Yamoussoukro", type: "caisse", establishmentId: "est-yam", openingBalance: 120000, openingDate: "2026-01-01", provider: "Espèces" },
  { id: "acc-banque", name: "Banque partenaire (simulée)", type: "banque", establishmentId: "est-abj", openingBalance: 12000000, openingDate: "2026-01-01", provider: "Compte bancaire fictif" },
  { id: "acc-om", name: "Mobile Money — Orange (simulé)", type: "mobile_money", establishmentId: "est-abj", openingBalance: 180000, openingDate: "2026-01-01", provider: "Opérateur Mobile Money (simulation)" },
  { id: "acc-wave", name: "Mobile Money — Wave (simulé)", type: "mobile_money", establishmentId: "est-abj", openingBalance: 95000, openingDate: "2026-01-01", provider: "Opérateur Mobile Money (simulation)" },
];

export const TEMPLATES: MessageTemplate[] = [
  { id: "tpl-1", name: "Rappel de rendez-vous", channel: "sms", body: "Bonjour {client}, BIRCOVET vous rappelle le rendez-vous de {patient} le {date}. Merci de confirmer. (message de démonstration)" },
  { id: "tpl-2", name: "Rappel de vaccination", channel: "whatsapp", body: "Bonjour {client}, le rappel vaccinal de {patient} est prévu autour du {date} selon le protocole défini par votre vétérinaire. (démonstration)" },
  { id: "tpl-3", name: "Relance facture", channel: "email", body: "Bonjour {client}, sauf erreur de notre part, la facture {facture} présente un solde de {montant}. (démonstration — aucun envoi réel)" },
  { id: "tpl-4", name: "Suivi après consultation", channel: "sms", body: "Bonjour {client}, comment se porte {patient} depuis sa consultation ? L'équipe BIRCOVET. (démonstration)" },
  { id: "tpl-5", name: "Suivi après hospitalisation", channel: "whatsapp", body: "Bonjour {client}, nous prenons des nouvelles de {patient} suite à sa sortie. (démonstration)" },
];

export const TRAININGS: Training[] = [
  { id: "trn-1", code: "FOR-001", title: "Biosécurité en élevage avicole", description: "Bonnes pratiques d'hygiène, gestion des accès et nettoyage-désinfection (contenu fictif).", category: "Productions animales", durationDays: 2, defaultPrice: 75000 },
  { id: "trn-2", code: "FOR-002", title: "Premiers soins canins pour éleveurs", description: "Gestes de base et reconnaissance des signes d'alerte (contenu fictif).", category: "Animaux de compagnie", durationDays: 1, defaultPrice: 35000 },
  { id: "trn-3", code: "FOR-003", title: "Gestion d'une pharmacie vétérinaire", description: "Traçabilité des lots, péremptions et inventaires (contenu fictif).", category: "Gestion", durationDays: 1, defaultPrice: 50000 },
];

export const SETTINGS: Settings = {
  clinicName: "BIRCOVET",
  legalName: "BIRCOVET — Clinique vétérinaire (données fictives)",
  address: "Cocody Riviera 2, Abidjan, Côte d'Ivoire (adresse fictive)",
  phone: "+225 27 22 00 00 01",
  email: "contact@bircovet.demo",
  currency: "XOF",
  dateFormat: "dd/MM/yyyy",
  compactTables: false,
  productCategories: ["medicament", "vaccin", "antiparasitaire", "consommable", "aliment", "materiel"],
  expenseCategories: ["Achats stock", "Loyer", "Électricité / eau", "Carburant", "Maintenance", "Salaires", "Fournitures", "Communication", "Divers"],
  expiryAlertDays: 60,
  discountDelegationPct: 10,
  expenseDelegationAmount: 100000,
  reminderDefaultHours: 24,
  reminderDefaultChannel: "sms",
  vaccineReminderNote: "Les échéances de rappel sont saisies par le vétérinaire pour chaque patient ; aucune fréquence universelle n'est appliquée.",
  notifyLowStock: true,
  notifyExpiry: true,
  notifyOverdueInvoices: true,
  notifyTasks: true,
  documentFooter: "DÉMONSTRATION — SANS VALEUR FISCALE. Document généré par l'environnement de test BIRCOVET.",
  invoicePrefix: "DEMO-FAC",
  quotePrefix: "DEMO-DEV",
};
