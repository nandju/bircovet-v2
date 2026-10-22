/**
 * Cliva — modèle de données frontend (démonstration).
 * Ces types décrivent la forme des entités manipulées localement.
 * Ils sont conçus pour être remplacés/alignés sur les DTO du futur backend.
 */

export type ID = string;
export type ISODate = string; // "2026-10-11" ou ISO complet

export type RoleId =
  | "dg"
  | "vet"
  | "assistant"
  | "accueil"
  | "comptable"
  | "confrere";

export type SyncStatus = "synchronise" | "en_attente" | "conflit";

export interface EntityRef {
  kind:
    | "client"
    | "patient"
    | "consultation"
    | "hospitalisation"
    | "mission"
    | "exploitation"
    | "facture"
    | "formation"
    | "commande"
    | "reception"
    | "prescription"
    | "inventaire"
    | "correction"
    | "transfert"
    | "autre";
  id: ID;
}

export interface Note {
  id: ID;
  text: string;
  authorId: ID;
  date: ISODate;
  syncStatus?: SyncStatus;
}

export interface User {
  id: ID;
  name: string;
  email: string;
  roleId: RoleId;
  establishmentId: ID;
  title: string;
  phone: string;
  active: boolean;
  createdAt: ISODate;
  demoPassword: string; // mot de passe de démonstration public (aucune valeur réelle)
  sharedPatientIds?: ID[]; // confrère référent : dossiers explicitement partagés
}

export interface Establishment {
  id: ID;
  name: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  slotMinutes: number;
  openingHours: string;
  active: boolean;
  resources: string[];
  locations: string[]; // emplacements de stockage
  cages: string[]; // emplacements d'hospitalisation
}

/* ---------------- Clients & patients ---------------- */

export type ClientType = "particulier" | "entreprise";
export type ClientSegment = "standard" | "premium" | "eleveur" | "professionnel";

export interface ClientContact {
  id: ID;
  name: string;
  phone: string;
  relation: string;
}

export interface CommPrefs {
  sms: boolean;
  whatsapp: boolean;
  email: boolean;
  call: boolean;
}

export interface Client {
  id: ID;
  code: string;
  type: ClientType;
  name: string;
  phoneCode: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  contacts: ClientContact[];
  commPrefs: CommPrefs;
  segment: ClientSegment;
  payerName: string;
  payerTaxId: string;
  notes: Note[];
  status: "actif" | "archive";
  mergedIntoId?: ID;
  establishmentId: ID;
  createdAt: ISODate;
  lastActivityAt: ISODate;
}

export interface Vital {
  id: ID;
  date: ISODate;
  weightKg: number;
  temperature?: number;
  heartRate?: number;
  respRate?: number;
  authorId: ID;
}

export interface Vaccination {
  id: ID;
  name: string;
  date: ISODate;
  nextDue?: ISODate;
  authorId: ID;
  lotRef?: string;
}

export interface OwnerPeriod {
  clientId: ID;
  from: ISODate;
  to?: ISODate;
  reason: string;
}

export type ExamType =
  | "radiographie"
  | "echographie"
  | "biochimie"
  | "hematologie"
  | "endoscopie"
  | "cytologie"
  | "autre";

/** Examen complémentaire consigné dans le dossier patient. */
export interface PatientExam {
  id: ID;
  date: ISODate;
  type: ExamType;
  label: string;
  result: string;
  consultationId?: ID;
  /** Nom de fichier joint (contenu non persisté en démo). */
  fileName?: string;
  authorId: ID;
}

export interface PatientPhoto {
  id: ID;
  /** Data URL de l'image (persistée en démo — petits fichiers uniquement). */
  dataUrl: string;
  caption: string;
  date: ISODate;
}

export interface Patient {
  id: ID;
  code: string;
  name: string;
  species: string;
  breed: string;
  sex: "male" | "femelle" | "male_castre" | "femelle_sterilisee" | "inconnu";
  birthDate: ISODate;
  birthDateEstimated: boolean;
  chip: string;
  passport: string;
  insurance: string;
  color: string;
  ownerId: ID;
  ownerHistory: OwnerPeriod[];
  allergies: string[];
  alerts: string[];
  vitalStatus: "vivant" | "decede";
  deathDate?: ISODate;
  deathReason?: string;
  vitals: Vital[];
  vaccinations: Vaccination[];
  notes: Note[];
  photos: PatientPhoto[];
  exams: PatientExam[];
  archived: boolean;
  createdAt: ISODate;
}

/* ---------------- Exploitations ---------------- */

export type FarmType =
  | "avicole"
  | "bovin"
  | "porcin"
  | "ovin_caprin"
  | "piscicole"
  | "mixte";

export interface FarmBuilding {
  id: ID;
  name: string;
  kind: string;
  capacity: number;
  /** Superficie au sol (m²), si renseignée. */
  area?: number;
  length?: number;
  width?: number;
  height?: number;
  notes?: string;
}

export interface FarmLot {
  id: ID;
  name: string;
  species: string;
  /** Catégorie zootechnique libre (poulets de chair, pondeuses, truies, lapereaux…). */
  category?: string;
  /** Âge ou tranche d'âge des effectifs (texte libre, ex. « 3–8 semaines »). */
  ageRange?: string;
  buildingId?: ID;
  startDate: ISODate;
  status: "actif" | "cloture";
}

export interface Headcount {
  id: ID;
  lotId: ID;
  date: ISODate;
  count: number;
  authorId: ID;
  source: "visite" | "mission" | "declaration";
}

export interface AnimalMovement {
  id: ID;
  lotId: ID;
  date: ISODate;
  type: "entree" | "sortie" | "mortalite" | "vente" | "transfert";
  count: number;
  note: string;
}

export interface FarmVisit {
  id: ID;
  date: ISODate;
  vetId: ID;
  purpose: string;
  report: string;
  missionId?: ID;
}

export interface Farm {
  id: ID;
  code: string;
  name: string;
  clientId: ID;
  type: FarmType;
  location: string;
  region: string;
  gps: string;
  access: string;
  managerName: string;
  managerPhone: string;
  contacts: ClientContact[];
  status: "actif" | "inactif" | "suspendu";
  buildings: FarmBuilding[];
  lots: FarmLot[];
  headcounts: Headcount[];
  movements: AnimalMovement[];
  visits: FarmVisit[];
  createdAt: ISODate;
}

/* ---------------- Agenda ---------------- */

export type AppointmentStatus = "planifie" | "confirme" | "honore" | "annule" | "absent";
export type QueueStatus =
  | "attendu"
  | "arrive"
  | "regle"
  | "en_consultation"
  | "termine"
  | "annule";

export interface Reminder {
  enabled: boolean;
  channel: "sms" | "whatsapp" | "email" | "appel";
  offsetHours: number;
  simulatedAt?: ISODate;
}

export interface Appointment {
  id: ID;
  establishmentId: ID;
  clientId: ID;
  patientId?: ID;
  practitionerId: ID;
  start: ISODate; // ISO datetime
  durationMin: number;
  reason: string;
  resource: string;
  status: AppointmentStatus;
  queueStatus: QueueStatus;
  cancelReason?: string;
  reminder: Reminder;
  history: { date: ISODate; userId: ID; action: string }[];
  consultationId?: ID;
}

export interface Unavailability {
  id: ID;
  userId: ID;
  start: ISODate;
  end: ISODate;
  reason: string;
}

/* ---------------- Clinique ---------------- */

export type ClinicalStatus = "brouillon" | "a_valider" | "valide";
export type FinancialStatus =
  | "non_regle"
  | "regle_avance"
  | "exception_demandee"
  | "exception_approuvee"
  | "facture";

export interface BillableAct {
  id: ID;
  label: string;
  qty: number;
  unitPrice: number;
}

export interface Consultation {
  id: ID;
  code: string;
  establishmentId: ID;
  clientId: ID;
  patientId: ID;
  appointmentId?: ID;
  date: ISODate;
  reason: string;
  anamnesis: string;
  exam: string;
  weightKg?: number;
  temperature?: number;
  heartRate?: number;
  respRate?: number;
  hypotheses: string;
  diagnosis: string;
  complementaryExams: string;
  carePlan: string;
  observations: string;
  followUpDate?: ISODate;
  vetId: ID; // vétérinaire responsable
  authorId: ID; // auteur de la saisie
  status: ClinicalStatus;
  validatedById?: ID;
  validatedAt?: ISODate;
  financialStatus: FinancialStatus;
  paymentException?: {
    requestedById: ID;
    reason: string;
    decidedById?: ID;
    decision?: "approuvee" | "refusee";
    date: ISODate;
  };
  acts: BillableAct[];
  invoiceId?: ID;
  euthanasiaRecorded?: boolean;
  syncStatus?: SyncStatus;
}

export type PrescriptionStatus =
  | "brouillon"
  | "a_valider"
  | "validee"
  | "partiellement_delivree"
  | "delivree"
  | "annulee";

export interface LotAllocation {
  lotId: ID;
  qty: number;
}

export interface Delivery {
  id: ID;
  date: ISODate;
  qty: number;
  allocations: LotAllocation[];
  userId: ID;
  movementIds: ID[];
  opKey: string;
  kind: "delivrance" | "administration";
}

export interface Prescription {
  id: ID;
  code: string;
  patientId: ID;
  clientId: ID;
  consultationId?: ID;
  hospitalizationId?: ID;
  productId: ID;
  form: string;
  route: string;
  quantity: number; // en unité de vente/stock
  dose: string; // saisie libre par un professionnel
  frequency: string;
  duration: string;
  instructions: string;
  authorId: ID;
  vetId: ID;
  date: ISODate;
  status: PrescriptionStatus;
  validatedById?: ID;
  deliveries: Delivery[];
}

export interface CareAct {
  id: ID;
  date: ISODate;
  authorId: ID;
  label: string;
  productId?: ID;
  qty?: number;
  movementId?: ID;
  billingLine?: { label: string; qty: number; unitPrice: number; status: "provisoire" | "facturee" };
  opKey: string;
}

export interface Hospitalization {
  id: ID;
  code: string;
  patientId: ID;
  clientId: ID;
  establishmentId: ID;
  admittedAt: ISODate;
  reason: string;
  consent: { signed: boolean; signedBy: string; date?: ISODate };
  cage: string;
  quoteId?: ID;
  vetId: ID;
  carePlan: { id: ID; label: string; schedule: string; done: boolean }[];
  observations: { id: ID; date: ISODate; authorId: ID; text: string }[];
  transmissions: { id: ID; date: ISODate; authorId: ID; text: string; shift: string }[];
  careActs: CareAct[];
  status: "en_cours" | "sortie_medicale" | "cloture";
  dischargedAt?: ISODate;
  dischargeNotes?: string;
  followUp?: { date: ISODate; notes: string; done: boolean };
  invoiceId?: ID;
  dailyRate: number;
}

/* ---------------- Missions terrain ---------------- */

export type MissionStatus = "brouillon" | "planifiee" | "en_cours" | "terminee" | "annulee";

export interface MissionStockLine {
  id: ID;
  productId: ID;
  lotId: ID;
  transferred: number;
  consumed: number;
  delivered: number;
  lost: number;
  returned: number;
  transferMovementId?: ID;
  reconciled: boolean;
}

export type MissionCategory = "exploitation" | "domicile" | "interne" | "urgence" | "hors_horaires";

export type ServiceType = "intervention" | "consultance" | "formation_fdfp" | "insemination" | "autre";

/** Action à mener issue d'une mission/visite (responsable + échéance). */
export interface MissionAction {
  id: ID;
  label: string;
  assigneeId?: ID;
  dueDate?: ISODate;
  done: boolean;
  note?: string;
}

export interface Mission {
  id: ID;
  code: string;
  objective: string;
  category: MissionCategory;
  serviceType: ServiceType;
  /** Libellé libre lorsque serviceType = "autre". */
  serviceLabel?: string;
  date: ISODate;
  endDate: ISODate;
  location: string;
  establishmentId: ID;
  leaderId: ID;
  teamIds: ID[];
  farmIds: ID[];
  clientIds: ID[];
  plannedInterventions: string[];
  interventionsDone: string[];
  actionItems: MissionAction[];
  stock: MissionStockLine[];
  observedHeadcounts: { farmId: ID; lotLabel: string; count: number }[];
  report: string;
  reportSyncStatus?: SyncStatus;
  status: MissionStatus;
  reconciledAt?: ISODate;
}

/* ---------------- Stock ---------------- */

export type ProductCategory =
  | "medicament"
  | "vaccin"
  | "antiparasitaire"
  | "consommable"
  | "aliment"
  | "materiel";

export interface Product {
  id: ID;
  code: string;
  name: string;
  category: ProductCategory;
  description: string;
  purchaseUnit: string;
  stockUnit: string;
  saleUnit: string;
  conversion: number; // unités de stock par unité d'achat
  alertThreshold: number;
  purchasePrice: number;
  salePrice: number;
  supplierId: ID;
  status: "actif" | "inactif";
  form: string;
  /** Principe actif / DCI (notice). */
  activeIngredient?: string;
  /** Espèces ciblées (texte libre issu de la notice). */
  targetSpecies?: string;
  /** Posologie documentée (notice du fabricant). */
  posologie?: string;
  contraIndications?: string;
  conservation?: string;
  /** Produit à usage humain — jamais d'extrapolation automatique de posologie. */
  humanUse?: boolean;
  /** Dosage structuré validé pour le calculateur (issu de la notice, pas inventé). */
  dosage?: { perKg: number; unit: string; species?: string; note?: string };
}

export type LotStatus = "disponible" | "reserve" | "quarantaine" | "perime";

export interface StockLot {
  id: ID;
  ref: string;
  productId: ID;
  supplierId: ID;
  establishmentId: ID;
  location: string;
  receivedAt: ISODate;
  expiryDate: ISODate;
  qtyReceived: number;
  qtyAvailable: number;
  unitCost: number;
  status: LotStatus;
  receptionId?: ID;
}

export type MovementType =
  | "reception"
  | "delivrance"
  | "administration"
  | "transfert_sortie"
  | "transfert_entree"
  | "mission_sortie"
  | "mission_retour"
  | "perte"
  | "retour_fournisseur"
  | "correction"
  | "inventaire";

export interface StockMovement {
  id: ID;
  date: ISODate;
  productId: ID;
  lotId: ID;
  establishmentId: ID;
  type: MovementType;
  qty: number; // signé : + entrée / - sortie
  userId: ID;
  ref?: EntityRef;
  note: string;
  opKey: string;
}

export interface StockCorrection {
  id: ID;
  date: ISODate;
  lotId: ID;
  productId: ID;
  qtyDelta: number;
  reason: string;
  kind: "correction" | "inventaire" | "perte" | "retour_fournisseur";
  requestedById: ID;
  status: "proposee" | "validee" | "rejetee";
  decidedById?: ID;
  decidedAt?: ISODate;
  inventoryId?: ID;
}

export interface Inventory {
  id: ID;
  code: string;
  date: ISODate;
  establishmentId: ID;
  authorId: ID;
  status: "en_cours" | "propose" | "valide";
  lines: { lotId: ID; expected: number; counted: number | null }[];
}

export interface StockTransfer {
  id: ID;
  code: string;
  date: ISODate;
  fromEstablishmentId: ID;
  toEstablishmentId: ID;
  lotId: ID;
  qty: number;
  userId: ID;
  status: "effectue";
}

/* ---------------- Achats ---------------- */

export interface Supplier {
  id: ID;
  code: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  category: string;
  paymentTerms: string;
  status: "actif" | "inactif";
}

export type POStatus =
  | "brouillon"
  | "envoyee"
  | "partiellement_recue"
  | "recue"
  | "cloturee"
  | "annulee";

export interface PurchaseOrderLine {
  id: ID;
  productId: ID;
  qtyOrdered: number; // en unité de stock
  unitPrice: number;
}

export interface PurchaseOrder {
  id: ID;
  code: string;
  supplierId: ID;
  establishmentId: ID;
  date: ISODate;
  expectedDate: ISODate;
  lines: PurchaseOrderLine[];
  status: POStatus;
  authorId: ID;
  notes: string;
}

export interface ReceptionLine {
  id: ID;
  poLineId?: ID;
  productId: ID;
  qtyOrdered: number;
  qtyReceived: number;
  lotRef: string;
  expiryDate: ISODate;
  unitCost: number;
}

export interface Reception {
  id: ID;
  code: string;
  poId?: ID;
  supplierId: ID;
  establishmentId: ID;
  date: ISODate;
  source: "manuel" | "bli_edi";
  deliveryNoteRef: string;
  status: "proposee" | "validee" | "rejetee";
  lines: ReceptionLine[];
  authorId: ID;
  validatedById?: ID;
  validatedAt?: ISODate;
}

/* ---------------- Facturation ---------------- */

export type SourceKind = "consultation" | "hospitalisation" | "formation" | "mission" | "vente";

export interface InvoiceLine {
  id: ID;
  label: string;
  kind: "service" | "produit";
  productId?: ID;
  qty: number;
  unitPrice: number;
  discountPct: number;
  source?: { kind: SourceKind; id: ID; label: string };
}

export type QuoteStatus = "brouillon" | "envoye" | "accepte" | "refuse" | "converti";

export interface Quote {
  id: ID;
  code: string;
  clientId: ID;
  patientId?: ID;
  establishmentId: ID;
  date: ISODate;
  validUntil: ISODate;
  lines: InvoiceLine[];
  status: QuoteStatus;
  authorId: ID;
  notes: string;
  invoiceId?: ID;
}

export type InvoiceStatus =
  | "brouillon"
  | "a_valider"
  | "validee"
  | "partiellement_payee"
  | "payee"
  | "en_retard"
  | "annulee";

export interface Invoice {
  id: ID;
  code: string;
  /** "proforma" : document commercial non engageant, hors balance et sans règlement. */
  kind: "facture" | "avoir" | "proforma";
  clientId: ID;
  payerName: string;
  establishmentId: ID;
  date: ISODate;
  dueDate: ISODate;
  lines: InvoiceLine[];
  status: InvoiceStatus;
  authorId: ID;
  validatedById?: ID;
  validatedAt?: ISODate;
  originalInvoiceId?: ID; // pour un avoir ou une facture issue d'un pro forma
  /** Facture créée à partir de ce document (pro forma converti). */
  convertedToInvoiceId?: ID;
  creditNoteIds: ID[];
  /**
   * Distinction FNE / hors FNE (champ informatif de démonstration).
   * La conformité FNE réelle nécessite l'intégration du système officiel —
   * non simulée dans cet environnement.
   */
  fneStatus?: "fne" | "hors_fne" | "non_renseigne";
  correctionReason?: string;
  quoteId?: ID;
  fiscalStatus: "non_concerne_demo" | "a_transmettre_backend";
  notes: string;
  discountApprovedById?: ID;
}

/* ---------------- Finances ---------------- */

export type PaymentMethod = "especes" | "mobile_money" | "carte" | "virement" | "cheque";

export interface Account {
  id: ID;
  name: string;
  type: "caisse" | "banque" | "mobile_money";
  establishmentId: ID;
  openingBalance: number;
  openingDate: ISODate;
  provider: string;
}

export interface Payment {
  id: ID;
  code: string;
  date: ISODate;
  clientId: ID;
  amount: number;
  method: PaymentMethod;
  accountId: ID;
  kind: "reglement" | "acompte" | "ancienne_creance";
  allocations: { invoiceId?: ID; receivableId?: ID; amount: number }[];
  reference: string;
  userId: ID;
  opKey: string;
  note: string;
}

export interface Expense {
  id: ID;
  code: string;
  date: ISODate;
  accountId: ID;
  category: string;
  label: string;
  amount: number;
  status: "en_attente" | "approuvee" | "rejetee";
  requestedById: ID;
  decidedById?: ID;
  decidedAt?: ISODate;
  withinDelegation: boolean;
  confidential?: boolean;
  /** Justificatif joint (image/scan/PDF — nom + data URL en démo). */
  attachmentName?: string;
  attachmentDataUrl?: string;
}

export interface AccountTransfer {
  id: ID;
  code: string;
  date: ISODate;
  fromAccountId: ID;
  toAccountId: ID;
  amount: number;
  fees: number;
  userId: ID;
  note: string;
}

export interface CashClosing {
  id: ID;
  date: ISODate;
  accountId: ID;
  expected: number;
  counted: number;
  userId: ID;
  note: string;
}

export interface CreditRequest {
  id: ID;
  code: string;
  clientId: ID;
  ceiling: number;
  dueDate: ISODate;
  reason: string;
  requestedById: ID;
  date: ISODate;
  status: "en_attente" | "approuve" | "refuse";
  decidedById?: ID;
  decidedAt?: ISODate;
  decisionNote?: string;
  history: { date: ISODate; userId: ID; action: string; note?: string }[];
}

export interface OpeningReceivable {
  id: ID;
  code: string;
  clientId: ID;
  label: string;
  amount: number;
  originDate: ISODate;
}

export interface Salary {
  id: ID;
  userId: ID;
  month: string;
  gross: number;
  net: number;
}

/* ---------------- Relation client ---------------- */

export type TaskStatus = "a_faire" | "en_cours" | "en_attente" | "termine";
export type TaskCategory =
  | "rappel"
  | "impaye"
  | "suivi_consultation"
  | "suivi_hospitalisation"
  | "relance_inactif"
  | "administratif";

export interface Task {
  id: ID;
  title: string;
  description: string;
  assigneeId: ID;
  priority: "basse" | "normale" | "haute" | "urgente";
  dueDate: ISODate;
  status: TaskStatus;
  category: TaskCategory;
  clientId?: ID;
  patientId?: ID;
  result: string;
  history: { date: ISODate; userId: ID; action: string; note?: string }[];
}

export interface MessageTemplate {
  id: ID;
  name: string;
  channel: "sms" | "whatsapp" | "email";
  body: string;
}

export interface Interaction {
  id: ID;
  clientId: ID;
  date: ISODate;
  channel: "sms" | "whatsapp" | "email" | "appel" | "visite";
  summary: string;
  userId: ID;
  simulated: boolean;
}

/* ---------------- Formations ---------------- */

export interface Training {
  id: ID;
  code: string;
  title: string;
  description: string;
  category: string;
  durationDays: number;
  defaultPrice: number;
}

export interface Participant {
  id: ID;
  name: string;
  phone: string;
  payerClientId: ID;
  registeredAt: ISODate;
  attendance: Record<string, boolean>;
  invoiceId?: ID;
}

export interface TrainingSession {
  id: ID;
  code: string;
  trainingId: ID;
  title: string;
  description: string;
  startDate: ISODate;
  endDate: ISODate;
  location: string;
  modality: "presentiel" | "distanciel" | "terrain";
  capacity: number;
  trainers: string[];
  participants: Participant[];
  status: "planifiee" | "ouverte" | "complete" | "terminee" | "annulee";
  price: number;
  history: { date: ISODate; userId: ID; action: string }[];
}

/* ---------------- Documents ---------------- */

export type DocCategory =
  | "rapport"
  | "analyse"
  | "radiographie"
  | "compte_rendu"
  | "consentement"
  | "ordonnance"
  | "administratif";

export interface DocumentItem {
  id: ID;
  title: string;
  category: DocCategory;
  linked: EntityRef;
  authorId: ID;
  date: ISODate;
  version: number;
  status: "actif" | "archive";
  fileName: string;
  mimeType: string;
  size: number;
  contentText?: string; // contenu fictif pour prévisualisation
  localOnly?: boolean; // fichier sélectionné dans ce navigateur (URL temporaire non persistée)
}

/* ---------------- Dépôt-vente ---------------- */

export type ConsignmentStatus = "en_depot" | "en_tresorerie" | "a_credit" | "solde" | "retourne";

/** Produit confié en dépôt-vente — jamais assimilé automatiquement à une vente encaissée. */
export interface Consignment {
  id: ID;
  code: string;
  clientId: ID;
  productId: ID;
  qty: number;
  unitPrice: number;
  date: ISODate;
  status: ConsignmentStatus;
  note: string;
  history: { date: ISODate; userId: ID; action: string; note?: string }[];
}

/* ---------------- Espace équipe & réunions ---------------- */

export interface StaffPost {
  id: ID;
  authorId: ID;
  date: ISODate;
  text: string;
  /** Information importante épinglée en tête. */
  pinned: boolean;
  missionId?: ID;
  comments: { id: ID; authorId: ID; date: ISODate; text: string }[];
}

export interface Meeting {
  id: ID;
  code: string;
  title: string;
  date: ISODate;
  attendeeIds: ID[];
  /** Compte rendu (rédigé ou généré — toujours modifiable et validé avant diffusion). */
  report: string;
  reportValidated: boolean;
  actionItems: MissionAction[];
}

/* ---------------- Licences (suivi commercial, pas de paiement réel) ---------------- */

export interface LicenceRecord {
  id: ID;
  orgName: string;
  period: string;
  dueDate: ISODate;
  amount: number;
  status: "payee" | "en_attente" | "en_retard";
  history: { date: ISODate; userId?: ID; action: string; amount?: number; note?: string }[];
}

/* ---------------- Veille (hors ligne en démo) ---------------- */

export interface NewsItem {
  id: ID;
  title: string;
  source: string;
  date: ISODate;
  summary: string;
  topic: "sante_animale" | "pharmacie_vet" | "elevage" | "reglementation";
}

/* ---------------- Revue mensuelle des commandes ---------------- */

export interface OrderReview {
  id: ID;
  /** Mois au format YYYY-MM. */
  month: string;
  comment: string;
  userId: ID;
  date: ISODate;
}

/* ---------------- Annonce configurable du tableau de bord ---------------- */

export interface Promo {
  active: boolean;
  title: string;
  text: string;
  imageDataUrl?: string;
  link?: string;
  from?: ISODate;
  to?: ISODate;
}

/* ---------------- Transverse ---------------- */

export interface AuditEntry {
  id: ID;
  date: ISODate;
  userId: ID;
  module: string;
  action: string;
  target: string;
  oldValue?: string;
  newValue?: string;
  reason?: string;
  decision?: string;
}

export interface AppNotification {
  id: ID;
  date: ISODate;
  title: string;
  body: string;
  level: "info" | "succes" | "alerte" | "critique";
  read: boolean;
  link?: string;
}

export interface SyncOp {
  id: ID;
  opKey: string;
  date: ISODate;
  label: string;
  kind: "note_patient" | "rapport_mission" | "note_client";
  entity: EntityRef;
  payload: { text: string };
  status: "en_attente" | "synchronise" | "conflit";
  conflict?: { remoteText: string; remoteAuthor: string };
  syncedAt?: ISODate;
  userId: ID;
}

export interface AIMessage {
  id: ID;
  role: "user" | "assistant";
  content: string;
  date: ISODate;
  scenario?: string;
  draftStatus?: "brouillon" | "accepte" | "rejete" | "modifie";
  references?: { label: string; href?: string }[];
}

export interface AIConversation {
  id: ID;
  title: string;
  date: ISODate;
  messages: AIMessage[];
}

/** Personnalisation visuelle de la plateforme (par organisation). */
export interface Branding {
  /** Nom de la plateforme affiché (ex. « Cliva »). */
  platformName: string;
  /** Signature / slogan affiché dans l'interface. */
  slogan: string;
  /** Logo personnalisé (data URL, conservé dans les paramètres de l'organisation). */
  logoDataUrl: string;
  colors: { primary: string; secondary: string; tertiary: string };
  font: "outfit" | "inter" | "dm-sans" | "system";
}

export interface Settings {
  clinicName: string;
  legalName: string;
  address: string;
  phone: string;
  email: string;
  currency: "XOF";
  dateFormat: "dd/MM/yyyy" | "dd MMM yyyy";
  compactTables: boolean;
  productCategories: string[];
  expenseCategories: string[];
  expiryAlertDays: number;
  discountDelegationPct: number;
  expenseDelegationAmount: number;
  reminderDefaultHours: number;
  reminderDefaultChannel: Reminder["channel"];
  vaccineReminderNote: string;
  notifyLowStock: boolean;
  notifyExpiry: boolean;
  notifyOverdueInvoices: boolean;
  notifyTasks: boolean;
  documentFooter: string;
  invoicePrefix: string;
  quotePrefix: string;
  branding: Branding;
  /** Encart publicitaire optionnel du tableau de bord. */
  promo: Promo;
}

export interface DemoDB {
  schemaVersion: number;
  seededAt: ISODate;
  users: User[];
  establishments: Establishment[];
  clients: Client[];
  patients: Patient[];
  farms: Farm[];
  appointments: Appointment[];
  unavailabilities: Unavailability[];
  consultations: Consultation[];
  prescriptions: Prescription[];
  hospitalizations: Hospitalization[];
  missions: Mission[];
  products: Product[];
  lots: StockLot[];
  movements: StockMovement[];
  corrections: StockCorrection[];
  inventories: Inventory[];
  stockTransfers: StockTransfer[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  receptions: Reception[];
  quotes: Quote[];
  invoices: Invoice[];
  payments: Payment[];
  accounts: Account[];
  expenses: Expense[];
  accountTransfers: AccountTransfer[];
  closings: CashClosing[];
  credits: CreditRequest[];
  openingReceivables: OpeningReceivable[];
  salaries: Salary[];
  tasks: Task[];
  templates: MessageTemplate[];
  interactions: Interaction[];
  trainings: Training[];
  sessions: TrainingSession[];
  documents: DocumentItem[];
  audit: AuditEntry[];
  notifications: AppNotification[];
  syncQueue: SyncOp[];
  aiConversations: AIConversation[];
  consignments: Consignment[];
  staffPosts: StaffPost[];
  meetings: Meeting[];
  licences: LicenceRecord[];
  news: NewsItem[];
  orderReviews: OrderReview[];
  settings: Settings;
  counters: Record<string, number>;
}

export interface SessionState {
  userId: ID | null;
  establishmentId: ID | null;
  offline: boolean;
}

/** Contexte d'exécution d'une action simulée. */
export interface ActionCtx {
  user: User;
  establishmentId: ID;
  offline: boolean;
  now: ISODate;
}

export type ServiceResult<T = undefined> =
  | { ok: true; db: DemoDB; message?: string; data?: T }
  | { ok: false; error: string };
