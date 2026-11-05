/**
 * Cliva — modèle de données frontend (démonstration).
 * Ces types décrivent la forme des entités manipulées localement.
 * Ils sont conçus pour être remplacés/alignés sur les DTO du futur backend.
 */

export type ID = string;
export type ISODate = string; // "2026-10-11" ou ISO complet

export type RoleId =
  | "editeur"
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
  /** Fiche créée rapidement (nom + téléphone) : à compléter. */
  incomplete?: boolean;
  /** Recommandant : qui a envoyé ce client (nom libre ou client existant). */
  referredBy?: string;
  referredByClientId?: ID;
  /** Comment le client nous a connus (bouche-à-oreille, réseaux, passage, labo…). */
  acquisition?: string;
  /** Compte générique « client de passage » de la pharmacie. */
  isWalkIn?: boolean;
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
  /** Enregistré rapidement : informations à compléter. */
  incomplete?: boolean;
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

/** Intervention du cabinet sur l'exploitation (vaccination, traitement, prélèvement…). */
export interface FarmIntervention {
  id: ID;
  date: ISODate;
  kind: "vaccination" | "traitement" | "deparasitage" | "prelevement" | "analyse" | "autopsie" | "conseil" | "autre";
  species: string;
  lotId?: ID;
  count: number;
  /** Produit ou molécule utilisé (texte libre ou produit du stock). */
  product?: string;
  productId?: ID;
  /** Problème / motif observé (ex. « coccidiose », « boiterie »). */
  problem?: string;
  /** Analyse de laboratoire / autopsie : laboratoire, examen, résultat, lien du compte rendu. */
  lab?: { name?: string; test?: string; result?: string; status?: "envoye" | "resultat"; reportUrl?: string };
  note: string;
  byId: ID;
  missionId?: ID;
}

export interface FarmVisit {
  id: ID;
  date: ISODate;
  vetId: ID;
  purpose: string;
  report: string;
  missionId?: ID;
}

/** Animal identifié d'un élevage (boucle, tatouage, nom). */
export interface FarmAnimal {
  id: ID;
  tag: string;
  name?: string;
  species: string;
  sex?: "male" | "femelle";
  ageText?: string;
  lotId?: ID;
  status: "present" | "vendu" | "mort";
  addedAt: ISODate;
}

export type CareScope = "animal" | "lot" | "cheptel";
export type CareReason = "appel" | "visite_routine" | "traitement_routine" | "pathologie";
export type CareStatus = "en_cours" | "gueri" | "deces" | "cloture";

export interface CareTreatment {
  id: ID;
  product: string;
  productId?: ID;
  dose?: string;
  route?: string;
  duration?: string;
  count: number;
}

/** Nouvelles prises après l'intervention (appel, WhatsApp, passage). */
export interface CareFollowUp {
  id: ID;
  date: ISODate;
  byId: ID;
  channel: "appel" | "whatsapp" | "visite";
  state: "amelioration" | "stable" | "aggravation" | "gueri" | "deces";
  sick?: number;
  dead?: number;
  note: string;
}

/** Consultation et prise en charge en élevage : un animal, une bande ou tout le cheptel. */
export interface CareCase {
  id: ID;
  code: string;
  farmId: ID;
  scope: CareScope;
  reason: CareReason;
  animalId?: ID;
  lotId?: ID;
  species: string;
  /** Nombre d'animaux concernés. */
  count: number;
  openedAt: ISODate;
  vetId: ID;
  missionId?: ID;
  complaint: string;
  exam: { temperature?: number; heartRate?: number; respRate?: number; findings: string };
  diagnosis: string;
  treatments: CareTreatment[];
  advice: string;
  status: CareStatus;
  /** Prise en charge d'origine (ex. animal malade → tout le cheptel). */
  parentId?: ID;
  /** Prochaine prise de nouvelles. */
  nextCheck?: ISODate;
  followUps: CareFollowUp[];
  closedAt?: ISODate;
  outcome?: string;
}

/* ---------------- Index thérapeutique de la clinique ---------------- */

/** Ligne de l'index thérapeutique : référence de posologie saisie ou importée par la clinique. */
export interface DrugIndexEntry {
  id: ID;
  species: string;
  molecule: string;
  indication?: string;
  dosage?: string;
  route?: string;
  amm?: string;
  note?: string;
  sourceId?: ID;
  updatedAt: ISODate;
  updatedById: ID;
}

/** Tableau importé (ou saisie manuelle) dont viennent les lignes de l'index. */
export interface DrugIndexSource {
  id: ID;
  name: string;
  species: string;
  /** Référence de l'ouvrage ou du document (titre, auteur, édition). */
  reference?: string;
  fileName?: string;
  importedAt: ISODate;
  importedById: ID;
}

export interface DrugIndexState {
  entries: DrugIndexEntry[];
  sources: DrugIndexSource[];
}

/* ---------------- Prophylaxie ---------------- */

export type ProphyKind = "vaccination" | "deparasitage" | "vitamines" | "anticoccidien" | "antibiotique" | "desinfection" | "pesee" | "autre";

/** Action d'un modèle de programme, placée en jours depuis le début (J0 ou J1 selon le modèle). */
export interface ProphyStepTemplate {
  id: ID;
  day: number;
  kind: ProphyKind;
  label: string;
  product?: string;
  productId?: ID;
  dose?: string;
  route?: string;
  note?: string;
}

/** Programme de prophylaxie pré-enregistré (modèle réutilisable). */
export interface ProphylaxisProgram {
  id: ID;
  code: string;
  name: string;
  species: string;
  /** Catégorie : poulets de chair, pondeuses, chiot… */
  category?: string;
  /** Ce que représente le jour 0 ou 1 (arrivée des poussins, naissance…). */
  startLabel: string;
  description?: string;
  steps: ProphyStepTemplate[];
  active: boolean;
  createdAt: ISODate;
  updatedAt?: ISODate;
}

export type ProphyTarget = "cheptel" | "lot" | "animal" | "patient";

/** Action planifiée d'un programme appliqué, avec sa date prévue. */
export interface ProphyPlanStep extends ProphyStepTemplate {
  dueDate: ISODate;
  status: "a_faire" | "fait" | "annule";
  doneDate?: ISODate;
  doneById?: ID;
  doneNote?: string;
  lotRef?: string;
  /** Trace créée dans l'historique (intervention d'élevage ou vaccination du patient). */
  logId?: ID;
}

/** Programme appliqué à un cheptel, une bande, un animal identifié ou un animal de compagnie. */
export interface ProphylaxisPlan {
  id: ID;
  code: string;
  programId?: ID;
  name: string;
  species: string;
  target: ProphyTarget;
  farmId?: ID;
  lotId?: ID;
  animalId?: ID;
  patientId?: ID;
  count?: number;
  startDate: ISODate;
  startLabel: string;
  steps: ProphyPlanStep[];
  status: "en_cours" | "termine" | "arrete";
  vetId: ID;
  note?: string;
  createdAt: ISODate;
  createdById: ID;
  closedAt?: ISODate;
}

export interface FarmScaleSettings {
  /** Effectif à partir duquel l'élevage est « moyen » puis « gros », par espèce. */
  herd: Record<string, [number, number]>;
  /** Chiffre d'affaires 12 mois (FCFA) : moyen puis gros. */
  revenue: [number, number];
  /** Prendre en compte le chiffre d'affaires dans le classement. */
  useRevenue: boolean;
  /** Libellés des catégories. */
  labels: { petit: string; moyen: string; gros: string };
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
  interventions?: FarmIntervention[];
  /** Animaux identifiés (boucle, nom). */
  animals?: FarmAnimal[];
  /** Lien Google Maps de l'exploitation. */
  mapsUrl?: string;
  /** Catégorie fixée manuellement (prioritaire sur le calcul). */
  scaleOverride?: { scale: "petit" | "moyen" | "gros"; reason: string; byId: ID; at: ISODate };
  createdAt: ISODate;
}

/* ---------------- Agenda ---------------- */

export type AppointmentStatus = "demande" | "planifie" | "confirme" | "honore" | "annule" | "absent";
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
  /** Type d'activité (icône) ; déduit du motif s'il n'est pas renseigné. */
  kind?: import("./activityKinds").ActivityKind;
  /** Consultation à domicile (urgence ou à la demande du client). */
  home?: HomeVisit;
  /** Demande de RDV saisie par un collaborateur, en attente de l'accord du praticien. */
  request?: AppointmentRequest;
}

export interface AppointmentRequest {
  requestedById: ID;
  requestedAt: ISODate;
  note?: string;
  decidedById?: ID;
  decidedAt?: ISODate;
  decision?: "accepte" | "deplace" | "refuse";
  decisionNote?: string;
  /** Horaire demandé à l'origine (si le praticien a proposé un autre créneau). */
  originalStart?: ISODate;
}

/** Tutoriel vidéo du Centre d'aide. */
export interface Tutorial {
  id: ID;
  theme: string;
  title: string;
  minutes: number;
  /** Pages où le tutoriel est proposé dans l'aide. */
  routes: string[];
  audience: string;
  /** Lien YouTube ou Google Drive de la vidéo. */
  videoUrl?: string;
  /** Scénario : ce qu'on montre à l'écran et ce qu'on dit. */
  script: { show: string; say: string }[];
  /** Utilisateurs qui l'ont regardé. */
  seenBy?: ID[];
}

/** Famille de recettes : regroupe des sources (types d'actes, catégories de produits). */
export interface RevenueFamily {
  id: ID;
  name: string;
  /** Couleur (clé de palette) pour les graphiques. */
  color: string;
  /** Sources rattachées : « svc:vaccination », « prod:aliment »… */
  keys: string[];
  /** Objectif de chiffre d'affaires mensuel (facultatif). */
  monthlyTarget?: number;
}

/** Validation des RDV pris par les collaborateurs pour certains praticiens. */
export interface ApptApprovalSettings {
  enabled: boolean;
  /** Praticiens dont l'agenda est soumis à validation. */
  practitionerIds: ID[];
}

export interface HomeVisit {
  reason: "urgence" | "demande";
  address: string;
  mapsUrl?: string;
  /** Frais de déplacement (FCFA), ajoutés à la consultation. */
  travelFee: number;
  contactPhone?: string;
  departedAt?: ISODate;
  arrivedAt?: ISODate;
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
  /** Muqueuses : roses, pâles, congestionnées, ictériques, cyanosées. */
  mucous?: string;
  /** Temps de recoloration capillaire (secondes). */
  crtSec?: number;
  /** Déshydratation estimée (%). */
  dehydrationPct?: number;
  /** Note d'état corporel (1 à 9). */
  bodyCondition?: number;
  /** Douleur (0 à 10). */
  painScore?: number;
  /** Pouls : fort, faible, filant, irrégulier. */
  pulse?: string;
  /** Glycémie (g/L). */
  glycemia?: number;
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
  /** Ordonnance regroupant plusieurs médicaments : même identifiant et même numéro pour toutes ses lignes. */
  orderId?: ID;
  orderCode?: string;
  lineNo?: number;
  /** Consigne générale de l'ordonnance (reprise sur chaque ligne). */
  orderNote?: string;
  /** Médicaments déjà remis lors d'une vente au comptoir (pas de nouveau mouvement de stock). */
  saleInvoiceId?: ID;
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
  /** Dernière mise à jour du rapport et son auteur. */
  reportUpdatedAt?: ISODate;
  reportById?: ID;
  status: MissionStatus;
  reconciledAt?: ISODate;
  /** Type rural : visite de ferme, urgence, ou mission générale. */
  ruralType?: RuralType;
  /** Rapport structuré par rubriques (le champ report en est la version texte). */
  reportSections?: Record<string, string>;
  /** Photos illustrant le rapport (compressées dans le navigateur). */
  photos?: { id: ID; dataUrl: string; caption: string; section?: string; takenAt: ISODate; byId: ID }[];
  /** Appel d'urgence : qui, quand, pourquoi, gravité. */
  emergency?: EmergencyCall;
}

export type RuralType = "visite" | "urgence" | "mission";

export interface EmergencyCall {
  calledAt: ISODate;
  caller: string;
  callerPhone: string;
  reason: string;
  animals: string;
  severity: "vitale" | "grave" | "moderee";
  arrivedAt?: ISODate;
}

/* ---------------- Stock ---------------- */

/** Code de catégorie de produit : catégories d'origine (medicament, vaccin…) ou créées par le DG. */
export type ProductCategory = string;

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
  /** Précision de la catégorie (ex. vaccins → volaille). */
  subCategory?: string;
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
  /** Nom déposé / commercial (si différent du libellé de l'article). */
  brandName?: string;
  laboratory?: string;
  excipients?: string;
  indications?: string;
  /** Concentration réelle du produit : remplace la valeur par défaut de la molécule dans le calculateur. */
  concentration?: { value: number; unit: "mg/mL" | "µg/mL" | "%" | "mg/comprimé" | "UI/mL" };
  /** Composition : un ou plusieurs principes actifs de l'Index des molécules. */
  composition?: { moleculeId: string; amount?: number; unit?: string }[];
  /** Voies d'administration autorisées pour ce produit (ex. ["IV"] pour une forme IV uniquement). */
  routes?: string[];
  /** Poudre à reconstituer (flacon) : contenu en principes actifs et volume final après reconstitution. */
  vial?: { volumeMl: number; components: { name: string; mg: number }[]; note?: string };
  /** Délais d'attente de l'étiquette (animaux de rente), en jours. */
  withdrawalMeatDays?: number;
  withdrawalMilkDays?: number;
  /** Rayon de la vue générale (vaccins par espèce, antiparasitaires canins…). */
  shelf?: string;
}

/* ---------------- Index des molécules ---------------- */

export type MoleculeStatus = "brouillon" | "a_valider" | "valide" | "retire";

export interface MoleculeState {
  status: MoleculeStatus;
  version: number;
  validatedById?: ID;
  validatedAt?: ISODate;
  history: { date: ISODate; userId: ID; action: string; note?: string }[];
}

/** Fiche molécule créée dans la clinique (absente de la base fournie). */
export interface DraftMolecule {
  id: ID;
  name: string;
  synonyms: string[];
  family: string;
  indications: string;
  contraindications: string;
  createdById: ID;
  createdAt: ISODate;
  posologies: {
    id: ID;
    species: string;
    scheme: string;
    min: number;
    max: number;
    unit: string;
    bound: "fourchette" | "plafond" | "minimum";
    route: string;
    frequency: string;
    perDay: number | null;
    concValue?: number;
    concUnit?: string;
    alertText?: string;
  }[];
}

export interface CalcLogEntry {
  id: ID;
  date: ISODate;
  userId: ID;
  patientId?: ID;
  productId?: ID;
  moleculeId: string;
  posologyId: string;
  species: string;
  kg: number;
  dose: number;
  result: string;
  copied: string;
}

export interface PharmaState {
  states: Record<string, MoleculeState>;
  drafts: DraftMolecule[];
  calcLog: CalcLogEntry[];
  /** Comptes autorisés à valider une fiche (vétérinaires référents). */
  referentIds: ID[];
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
  /** Périmètre : inventaire complet, par catégorie ou par nom d'article. */
  scope?: { category?: string; search?: string; label: string };
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
  /** effectue = transfert historique direct ; en_transit → recu / recu_ecart = flux avec réception par l'annexe. */
  status: "effectue" | "en_transit" | "recu" | "recu_ecart" | "annule";
  /** Emplacement prévu chez le destinataire. */
  location?: string;
  note?: string;
  receivedQty?: number;
  receivedById?: ID;
  receivedAt?: ISODate;
  receptionNote?: string;
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
  /** Numéro de compte contribuable (DGI Côte d'Ivoire). */
  ncc?: string;
  rccm?: string;
  /** Commune / quartier et repère. */
  location?: string;
  gps?: string;
  website?: string;
  /** Fournisseur de stock ou prestataire de services (électricité, maintenance, labo…). */
  kind?: "fournisseur" | "prestataire";
  /** Délégués, commerciaux, transitaires… et leurs contacts. */
  intermediaries?: { id: ID; name: string; role: string; company?: string; phone: string; email?: string }[];
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
  /** Ligne de budget imputée. */
  budgetLineId?: ID;
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
  /** Contrôle ligne à ligne avant entrée en stock. */
  check?: { status: "conforme" | "ecart" | "refuse"; note?: string; byId: ID; at: ISODate };
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
  /** Numéro de la Facture Normalisée Électronique (FNE) délivré par la plateforme DGI. */
  fneNumber?: string;
  correctionReason?: string;
  quoteId?: ID;
  fiscalStatus: "non_concerne_demo" | "a_transmettre_backend";
  notes: string;
  /** Vente directe au comptoir de la pharmacie. */
  channel?: "comptoir";
  saleInfo?: { species?: string; purpose?: string; sellerId?: ID; /** Client de passage : nom et téléphone notés pour le suivi. */ contact?: { name?: string; phone?: string } };
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

/** Caisse de suivi : regroupe des encaissements, des prestations ou des entrées pour suivre une activité. */
export interface CashBox {
  id: ID;
  code: string;
  name: string;
  description?: string;
  color: string;
  /** Objectif à atteindre (facultatif). */
  target?: number;
  /** Compte où se trouve l'argent (facultatif). */
  accountId?: ID;
  active: boolean;
  createdAt: ISODate;
  entries: CashBoxEntry[];
}

export interface CashBoxEntry {
  id: ID;
  kind: "encaissement" | "prestation" | "entree";
  paymentId?: ID;
  invoiceId?: ID;
  lineId?: ID;
  label: string;
  amount: number;
  date: ISODate;
  byId: ID;
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
  /** Précision de la catégorie de dépense. */
  detail?: string;
  /** Ligne de budget imputée. */
  budgetLineId?: ID;
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
  /** Projet auquel la dépense est rattachée. */
  projectId?: ID;
  /** Preuves en ligne (Google Drive…). */
  proofLinks?: ProofLink[];
  /** Photos de factures / reçus prises avec le téléphone. */
  photos?: ProofPhoto[];
}

export interface ProofLink {
  id: ID;
  label: string;
  url: string;
  addedById: ID;
  addedAt: ISODate;
}

export interface ProofPhoto {
  id: ID;
  name: string;
  dataUrl: string;
  addedById: ID;
  addedAt: ISODate;
}

export type ProjectStatus = "en_cours" | "suspendu" | "termine";

/** Projet (travaux, campagne, équipement…) auquel on rattache des dépenses. */
export interface Project {
  id: ID;
  code: string;
  name: string;
  description?: string;
  /** Enveloppe prévue (FCFA), facultative. */
  budget?: number;
  startDate?: ISODate;
  endDate?: ISODate;
  status: ProjectStatus;
  ownerId?: ID;
  /** Dossier Drive du projet. */
  driveUrl?: string;
  establishmentId: ID;
  createdAt: ISODate;
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
  | "suivi_client"
  | "prospect"
  | "administratif"
  | "equipe"
  | "document";

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
  /** Tâche confiée à un membre de l'équipe (et par qui). */
  assignedById?: ID;
  /** Lien Drive du document produit. */
  driveUrl?: string;
  /** Contrôle par la personne qui a confié la tâche. */
  review?: { status: "a_verifier" | "valide" | "a_reprendre"; byId?: ID; at?: ISODate; note?: string };
}

export interface MessageTemplate {
  id: ID;
  name: string;
  channel: "sms" | "whatsapp" | "email";
  body: string;
  /** Étape de suivi (J0, J3… ou « periodique ») pour les modèles de relance. */
  stage?: string;
  /** Contexte d'usage : clinique compagnie, animaux de rente, prospects, ou général. */
  context?: FollowUpContext | "prospect" | "general";
}

/* ---------------- Suivi client (relances) ---------------- */

export type FollowUpContext = "compagnie" | "rente";
export type FollowUpSource = "consultation" | "hospitalisation" | "mission" | "prospect" | "manuel";
export type TouchOutcome = "rassure" | "a_revoir" | "besoin" | "injoignable" | "rdv_pris";

export interface FollowUpStep {
  /** Jour après l'événement (0, 3, 7…). */
  day: number;
  stage: string;
  label: string;
}

export interface FollowUpSettings {
  steps: FollowUpStep[];
  /** Intervalle des prises de nouvelles périodiques après la dernière étape (jours, 120 à 180). */
  recurringDays: number;
  autoStart: { consultation: boolean; hospitalisation: boolean; mission: boolean };
}

export interface FollowUpTouch {
  id: ID;
  stage: string;
  label: string;
  day: number;
  dueDate: ISODate;
  status: "a_faire" | "fait" | "ignore";
  attempts: number;
  doneAt?: ISODate;
  doneById?: ID;
  channel?: Interaction["channel"];
  outcome?: TouchOutcome;
  note?: string;
}

export interface FollowUpPlan {
  id: ID;
  clientId: ID;
  patientId?: ID;
  farmId?: ID;
  context: FollowUpContext;
  source: FollowUpSource;
  sourceId?: ID;
  /** Libellé lisible : « Consultation CONS-0012 — Rex (otite) ». */
  label: string;
  motif: string;
  startDate: ISODate;
  ownerId: ID;
  establishmentId: ID;
  status: "actif" | "termine" | "arrete";
  stopReason?: string;
  touches: FollowUpTouch[];
}

/* ---------------- Prospects (entonnoir) ---------------- */

export type ProspectStage = "nouveau" | "contacte" | "besoin_identifie" | "proposition" | "gagne" | "perdu";
export type ProspectSource = "appel" | "whatsapp" | "recommandation" | "reseaux" | "passage" | "terrain";

export interface Prospect {
  id: ID;
  code: string;
  name: string;
  phone: string;
  location: string;
  source: ProspectSource;
  activity: FollowUpContext | "mixte";
  /** Animaux / élevage concernés (texte libre). */
  animals: string;
  need: string;
  difficulties: string;
  stage: ProspectStage;
  nextAction: string;
  nextActionDate?: ISODate;
  estimatedValue: number;
  ownerId: ID;
  establishmentId: ID;
  createdAt: ISODate;
  updatedAt: ISODate;
  lostReason?: string;
  convertedClientId?: ID;
  history: { date: ISODate; userId: ID; action: string; note?: string; channel?: Interaction["channel"] }[];
}

export interface Interaction {
  id: ID;
  clientId: ID;
  /** Relance de suivi à l'origine du contact, le cas échéant. */
  touchId?: ID;
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

/** Annonce en rotation : publicité d'un partenaire (laboratoire) ou actualité de la clinique. */
export interface Announcement {
  id: ID;
  kind: "pub" | "actualite";
  /** Laboratoire ou partenaire (affiché « Sponsorisé · … »). */
  sponsor?: string;
  title: string;
  text: string;
  /** Image ou GIF animé (data URL). */
  imageDataUrl?: string;
  /** Route interne (/stock) ou adresse web (https://…). */
  link?: string;
  placements: ("dashboard" | "connexion" | "pharmacie")[];
  from?: ISODate;
  to?: ISODate;
  active: boolean;
  order: number;
  createdAt: ISODate;
  views: number;
  clicks: number;
  /** Campagne diffusée par l'éditeur Cliva (non désactivable par la clinique). */
  platform?: boolean;
}

/* ---------------- Plateforme (éditeur Cliva) ---------------- */

export type ClinicLanguage = "fr" | "en";
export type Clientele3 = "compagnie" | "rente" | "mixte";

/** Indicateurs d'usage d'un mois, anonymisés (aucun nom, aucun dossier, aucun montant). */
export interface UsageMonth {
  month: string;
  activeUsers: number;
  actions: number;
  consultations: number;
  appointments: number;
  sales: number;
  invoices: number;
  /** Nombre d'actions par module (agenda, stock…). */
  modules: Record<string, number>;
}

export interface LicencePayment {
  id: ID;
  date: ISODate;
  amount: number;
  kind: "licence" | "maintenance";
  note?: string;
  /** Pour la maintenance : nouvelle date de fin de couverture. */
  coversUntil?: ISODate;
}

/** Clinique cliente de la plateforme. */
export interface PlatformClinic {
  id: ID;
  name: string;
  country: string;
  city: string;
  language: ClinicLanguage;
  clientele: Clientele3;
  contactName: string;
  phone: string;
  email: string;
  status: "actif" | "suspendu" | "prospect";
  /** Vente directe de la licence (montant convenu). */
  licencePrice: number;
  soldAt?: ISODate;
  /** Maintenance (petit abonnement). */
  maintenanceAmount: number;
  maintenancePeriod: "mensuel" | "annuel";
  paidUntil?: ISODate;
  payments: LicencePayment[];
  users: number;
  sites: number;
  version: string;
  /** Usage mensuel remonté (démo : chiffres fictifs ; la clinique de la démo est calculée en direct). */
  usage: UsageMonth[];
  /** Clinique de cette démonstration (BIRCOVET). */
  isSelf?: boolean;
  notes?: string;
  createdAt: ISODate;
}

/** Campagne publicitaire poussée par l'éditeur vers les cliniques. */
export interface AdCampaign {
  id: ID;
  title: string;
  sponsor: string;
  text: string;
  imageDataUrl?: string;
  link?: string;
  placements: Announcement["placements"];
  from?: ISODate;
  to?: ISODate;
  active: boolean;
  /** Ciblage : vide = toutes. */
  target: { countries: string[]; languages: ClinicLanguage[]; clienteles: Clientele3[]; clinicIds: ID[] };
  /** Vues et clics par clinique. */
  stats: Record<ID, { views: number; clicks: number }>;
  /** Montant facturé à l'annonceur (facultatif). */
  price?: number;
  createdAt: ISODate;
}

export interface PlatformOffer {
  licencePrice: number;
  maintenanceAmount: number;
  maintenancePeriod: "mensuel" | "annuel";
  /** Jours de tolérance après l'échéance de maintenance. */
  graceDays: number;
  notes: string;
}

export interface PlatformState {
  editor: User;
  clinics: PlatformClinic[];
  campaigns: AdCampaign[];
  offer: PlatformOffer;
}

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
  /** Destinataires ciblés (sinon : visible par tous). */
  toUserIds?: ID[];
  toRoles?: RoleId[];
  /** Lu par (lecture individuelle). */
  readBy?: ID[];
  /** Afficher aussi en notification push du navigateur. */
  push?: boolean;
  /** Règle d'alerte à l'origine. */
  rule?: string;
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

export type EquipmentCondition = "neuf" | "bon" | "use" | "panne" | "reforme";

/** Matériel de la clinique (immobilisation) : ce qui est là et ce qu'il a coûté. */
export interface Equipment {
  id: ID;
  code: string;
  establishmentId: ID;
  name: string;
  category: string;
  brand?: string;
  serial?: string;
  location?: string;
  quantity: number;
  /** Montant d'achat unitaire (FCFA). */
  unitCost: number;
  purchaseDate?: ISODate;
  supplier?: string;
  condition: EquipmentCondition;
  warrantyUntil?: ISODate;
  nextMaintenance?: ISODate;
  invoiceUrl?: string;
  notes?: string;
  createdAt: ISODate;
  updatedAt: ISODate;
}

/** Filigrane imprimé en travers des documents (factures, ordonnances, rapports…). */
export interface Watermark {
  enabled: boolean;
  text: string;
  /** Opacité en % (3 à 40). */
  opacity: number;
  withLogo: boolean;
}

export interface Settings {
  /** Filigrane des documents imprimables. */
  watermark?: Watermark;
  /** RDV soumis à l'accord du praticien. */
  apptApproval?: ApptApprovalSettings;
  /** Familles de recettes (regroupements d'actes et de catégories de produits) pour l'analyse. */
  revenueFamilies?: RevenueFamily[];
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
  /** Cadence et déclenchement des relances de suivi client. */
  followUp?: FollowUpSettings;
  /** Règles d'alerte paramétrables. */
  alertRules?: AlertRule[];
  /** Seuils de catégorie d'éleveur (effectif par espèce, chiffre d'affaires). */
  farmScale?: FarmScaleSettings;
  /** Libellés personnalisés des catégories de produits. */
  categoryLabels?: Record<string, string>;
  /** Précisions (sous-catégories) par catégorie : produits et dépenses. */
  categoryDetails?: Record<string, string[]>;
  expenseDetails?: Record<string, string[]>;
  /** Matrice des droits modifiée par le DG (lettres r c u v e a par module). */
  permissions?: Partial<Record<RoleId, Partial<Record<string, string>>>>;
  /** Libellés et descriptions des rôles modifiés. */
  roleLabels?: Partial<Record<RoleId, { label?: string; description?: string }>>;
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
  followUps: FollowUpPlan[];
  pharma?: PharmaState;
  announcements?: Announcement[];
  /** Factures fournisseurs et prestataires (dettes) et leurs règlements. */
  bills?: SupplierBill[];
  /** Demandes d'aval adressées au directeur. */
  approvals?: ApprovalRequest[];
  /** Protocoles et fiches internes. */
  protocols?: Protocol[];
  /** Liens externes (Google Drive, Docs, Sheets, Maps…) rattachés aux dossiers. */
  links?: ExternalLink[];
  /** Alertes déjà envoyées (clé de déduplication → date). */
  alertLog?: Record<string, string>;
  /** Traitements suivis (hospitalisation ou domicile). */
  treatments?: TreatmentCourse[];
  /** Congés, permissions et absences du personnel. */
  leaves?: LeaveRequest[];
  /** Objectifs individuels du personnel. */
  objectives?: StaffObjective[];
  /** Évaluations (notes) du personnel. */
  evaluations?: StaffEvaluation[];
  /** Budgets préparés par l'équipe et validés par le DG. */
  budgets?: Budget[];
  /** Caisses de suivi. */
  cashBoxes?: CashBox[];
  /** Consultations et prises en charge en élevage. */
  careCases?: CareCase[];
  /** Index thérapeutique propre à la clinique (posologies de référence importées ou saisies). */
  drugIndex?: DrugIndexState;
  /** Modèles de programmes de prophylaxie. */
  prophylaxisPrograms?: ProphylaxisProgram[];
  /** Programmes de prophylaxie appliqués (élevages et animaux de compagnie). */
  prophylaxisPlans?: ProphylaxisPlan[];
  /** Espace éditeur Cliva (en production : base séparée, hors des données des cliniques). */
  platform?: PlatformState;
  /** Tutoriels vidéo du Centre d'aide. */
  tutorials?: Tutorial[];
  /** Projets auxquels on rattache des dépenses. */
  projects?: Project[];
  /** Inventaire du matériel (équipements, mobilier, informatique…) avec montant d'achat. */
  equipment?: Equipment[];
  /** Dossiers administratifs (registre, répertoire Drive, obligations). */
  adminFiles?: AdminFile[];
  adminDirectory?: AdminDirectoryEntry[];
  adminObligations?: AdminObligation[];
  prospects: Prospect[];
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

/* ---------------- Suivi des traitements ---------------- */

export type TreatmentSetting = "hospitalisation" | "domicile";

/** Une prise prévue (jour + créneau) et ce qui a été fait. */
export interface DoseLog {
  id: ID;
  day: ISODate; // AAAA-MM-JJ
  slot: string; // HH:MM prévu
  status: "donne" | "manque" | "refuse";
  /** Membre de l'équipe (clinique) ou propriétaire (domicile). */
  by: "equipe" | "proprietaire";
  userId: ID; // saisi par
  at: ISODate;
  channel?: "sur_place" | "appel" | "whatsapp" | "sms" | "visite";
  note?: string;
}

export interface EvolutionNote {
  id: ID;
  date: ISODate;
  trend: "amelioration" | "stable" | "aggravation" | "gueri";
  text: string;
  source: "clinique" | "proprietaire";
  userId: ID;
}

export interface TreatmentCourse {
  id: ID;
  code: string;
  patientId: ID;
  clientId: ID;
  setting: TreatmentSetting;
  hospitalizationId?: ID;
  consultationId?: ID;
  label: string; // médicament ou soin
  productId?: ID;
  dose: string;
  route: string;
  slots: string[]; // horaires des prises, ex. ["08:00","20:00"]
  startDate: ISODate;
  days: number;
  vetId: ID;
  /** Assistant responsable (clinique) ou contact du propriétaire (domicile). */
  responsibleId?: ID;
  instructions?: string;
  status: "actif" | "termine" | "arrete";
  stopReason?: string;
  doses: DoseLog[];
  evolution: EvolutionNote[];
  createdAt: ISODate;
}

/* ---------------- Personnel ---------------- */

export type LeaveKind = "conge" | "permission" | "maladie" | "formation" | "autre";

export interface LeaveRequest {
  id: ID;
  userId: ID;
  kind: LeaveKind;
  start: ISODate; // AAAA-MM-JJ
  end: ISODate;
  /** Permission de quelques heures (heures de début/fin). */
  hours?: { from: string; to: string };
  reason: string;
  status: "en_attente" | "approuvee" | "refusee" | "annulee";
  requestedAt: ISODate;
  decidedById?: ID;
  decidedAt?: ISODate;
  decisionNote?: string;
  unavailabilityId?: ID;
}

export interface StaffObjective {
  id: ID;
  userId: ID;
  title: string;
  /** Indicateur mesurable (ex. « relances effectuées », « ventes comptoir »). */
  metric: string;
  target: number;
  current: number;
  unit: string;
  period: string; // ex. « T4 2026 »
  dueDate: ISODate;
  status: "en_cours" | "atteint" | "non_atteint" | "abandonne";
  reviews: { id: ID; date: ISODate; byId: ID; text: string; value?: number }[];
  createdById: ID;
  createdAt: ISODate;
}

/* ---------------- Alertes, avals, protocoles, liens ---------------- */

export interface AlertRule {
  key: string;
  enabled: boolean;
  /** Paramètre chiffré de la règle (jours, heures…). */
  threshold: number;
  /** Rôles destinataires. */
  roles: RoleId[];
  /** Prévenir aussi la personne concernée (responsable, assigné…). */
  owner: boolean;
  push: boolean;
}

export interface ApprovalRequest {
  id: ID;
  code: string;
  refKind: "mission" | "rapport" | "action" | "facture" | "commande" | "traitement" | "exploitation" | "depense" | "autre";
  refId?: ID;
  link?: string;
  title: string;
  detail: string;
  amount?: number;
  urgency: "normale" | "urgente";
  requestedById: ID;
  requestedAt: ISODate;
  toUserId: ID;
  status: "en_attente" | "approuvee" | "refusee" | "info_demandee";
  decisionNote?: string;
  decidedAt?: ISODate;
  history: { date: ISODate; userId: ID; text: string }[];
}

export type ProtocolCategory = "prise_en_charge" | "parcours_client" | "accueil" | "avant_visite" | "avant_chirurgie" | "hygiene" | "autre";

export interface Protocol {
  id: ID;
  code: string;
  title: string;
  category: ProtocolCategory;
  /** Pathologie ou situation visée. */
  subject: string;
  species: string[];
  summary: string;
  steps: { id: ID; text: string; critical?: boolean }[];
  materials: string[];
  warnings: string;
  links: { label: string; url: string }[];
  status: "brouillon" | "valide" | "archive";
  version: number;
  authorId: ID;
  validatedById?: ID;
  updatedAt: ISODate;
}

export interface ExternalLink {
  id: ID;
  ref: { kind: EntityRef["kind"] | "protocole"; id: ID };
  label: string;
  url: string;
  addedById: ID;
  addedAt: ISODate;
}

/* ---------------- Dettes fournisseurs et prestataires ---------------- */

export interface SupplierBillPayment {
  id: ID;
  date: ISODate;
  amount: number;
  accountId: ID;
  method: PaymentMethod;
  reference: string;
  byId: ID;
}

export interface SupplierBill {
  id: ID;
  code: string;
  supplierId: ID;
  /** Achat de stock (réception), prestation de service, ou dépôt-vente (payé au fur et à mesure des ventes). */
  kind: "achat_stock" | "prestation" | "depot_vente";
  /** N° de la facture du fournisseur. */
  ref: string;
  label: string;
  date: ISODate;
  dueDate: ISODate;
  amount: number;
  receptionId?: ID;
  lines: { productId: ID; qty: number; unitCost: number }[];
  /** Rembourser au rythme des ventes des articles achetés. */
  payAsSold: boolean;
  payments: SupplierBillPayment[];
  status: "ouverte" | "soldee" | "annulee";
  notes?: string;
  createdAt: ISODate;
  createdById: ID;
}

export interface StaffEvaluation {
  id: ID;
  userId: ID;
  period: string; // ex. « Octobre 2026 », « T4 2026 »
  date: ISODate;
  byId: ID;
  /** Note de 1 à 5 par critère. */
  scores: Record<string, number>;
  strengths: string;
  improvements: string;
  comment: string;
}

/* ---------------- Budgets ---------------- */

export interface BudgetLine {
  id: ID;
  /** Catégorie de dépense ou « Achats de stock ». */
  category: string;
  label: string;
  amount: number;
  note?: string;
}

export interface Budget {
  id: ID;
  code: string;
  title: string;
  /** Mois concerné (AAAA-MM). */
  period: string;
  establishmentId: ID;
  preparedById: ID;
  lines: BudgetLine[];
  justification: string;
  status: "brouillon" | "soumis" | "valide" | "refuse";
  submittedAt?: ISODate;
  decidedById?: ID;
  decidedAt?: ISODate;
  decisionNote?: string;
  history: { date: ISODate; userId: ID; text: string }[];
}

/* ---------------- Dossiers administratifs ---------------- */

export interface AdminFile {
  id: ID;
  number: string;
  name: string;
  category: string;
  subCategory?: string;
  description?: string;
  year: string;
  openedAt: ISODate;
  dueDate?: ISODate;
  periodicity: string;
  responsible: string;
  status: "en_cours" | "complet" | "en_retard" | "a_faire";
  driveUrl?: string;
  notes?: string;
  updatedAt: ISODate;
}

export interface AdminDirectoryEntry {
  id: ID;
  section: string;
  name: string;
  category: string;
  classement: string;
  content: string;
  location: string;
  url?: string;
}

export interface AdminObligation {
  id: ID;
  month: string;
  label: string;
  category: string;
  periodicity: string;
  legalDeadline: string;
  responsible: string;
  /** Mois (1-12) et jour de l'échéance légale, pour les rappels. */
  dueMonth?: number;
  dueDay?: number;
  done?: Record<string, boolean>; // par année
}
