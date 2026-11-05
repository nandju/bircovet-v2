import type { RoleId } from "./types";

/**
 * Matrice de permissions SIMULÉE côté frontend.
 * ⚠️ Ne constitue en aucun cas une protection des données : les contrôles
 * d'autorisation réels seront implémentés côté serveur (phase backend).
 */

export type ModuleId =
  | "dashboard"
  | "agenda"
  | "clients"
  | "patients"
  | "exploitations"
  | "consultations"
  | "prescriptions"
  | "hospitalisation"
  | "missions"
  | "stock"
  | "achats"
  | "facturation"
  | "finances"
  | "salaires"
  | "relation"
  | "formations"
  | "documents"
  | "rapports"
  | "ia"
  | "admin"
  | "plateforme";

export type PermAction = "read" | "create" | "update" | "validate" | "export" | "admin";

export const MODULE_LABELS: Record<ModuleId, string> = {
  dashboard: "Vue d'ensemble",
  agenda: "Agenda et accueil",
  clients: "Clients",
  patients: "Patients",
  exploitations: "Exploitations",
  consultations: "Consultations",
  prescriptions: "Prescriptions / délivrances",
  hospitalisation: "Hospitalisation",
  missions: "Missions terrain",
  stock: "Pharmacie et stock",
  achats: "Achats et fournisseurs",
  facturation: "Devis et facturation",
  finances: "Caisse et finances",
  salaires: "Salaires et résultats confidentiels",
  relation: "Relation client",
  formations: "Formations",
  documents: "Documents",
  rapports: "Rapports",
  ia: "Assistant IA",
  admin: "Administration",
  plateforme: "Console éditeur Cliva",
};

export const ACTION_LABELS: Record<PermAction, string> = {
  read: "Lecture",
  create: "Création",
  update: "Modification",
  validate: "Validation",
  export: "Export",
  admin: "Administration",
};

export const ROLE_LABELS: Record<RoleId, string> = {
  editeur: "Éditeur Cliva",
  dg: "DG vétérinaire",
  vet: "Vétérinaire habilité",
  assistant: "Assistant technique",
  accueil: "Accueil et stock",
  comptable: "Consultant comptable",
  confrere: "Confrère référent",
};

export const ROLE_DESCRIPTIONS: Record<RoleId, string> = {
  editeur: "Console de la plateforme : cliniques clientes, licences, statistiques d'usage anonymisées et campagnes publicitaires. Aucun accès aux données des cliniques.",
  dg: "Direction, administration, validation financière et données confidentielles.",
  vet: "Dossiers cliniques, consultations, prescriptions, hospitalisations et documents autorisés.",
  assistant: "Tâches attribuées, soins autorisés, missions terrain et opérations de stock permises.",
  accueil: "Rendez-vous, clients, file d'attente, accueil et préparation du stock.",
  comptable: "Lecture des données financières autorisées et exports prévus (hors salaires).",
  confrere: "Consultation des seuls dossiers et documents explicitement partagés.",
};

type Perms = Partial<Record<ModuleId, string>>; // lettres : r c u v e a

const ALL = "rcuvea";

const MATRIX: Record<RoleId, Perms> = {
  editeur: { plateforme: ALL },
  dg: Object.fromEntries(
    (Object.keys(MODULE_LABELS) as ModuleId[]).filter((m) => m !== "plateforme").map((m) => [m, ALL]),
  ) as Perms,
  vet: {
    dashboard: "r",
    agenda: "rcu",
    clients: "rcue",
    patients: "rcue",
    exploitations: "rcu",
    consultations: "rcuve",
    prescriptions: "rcuv",
    hospitalisation: "rcuv",
    missions: "rcu",
    stock: "ru",
    achats: "r",
    facturation: "rc",
    relation: "rcu",
    formations: "r",
    documents: "rcue",
    rapports: "r",
    ia: "rc",
  },
  assistant: {
    dashboard: "r",
    agenda: "ru",
    clients: "r",
    patients: "ru",
    exploitations: "ru",
    consultations: "rc",
    prescriptions: "ru",
    hospitalisation: "ru",
    missions: "ru",
    stock: "rcu",
    achats: "rc",
    relation: "ru",
    documents: "rc",
    ia: "rc",
  },
  accueil: {
    dashboard: "r",
    agenda: "rcue",
    clients: "rcue",
    patients: "rcu",
    exploitations: "r",
    consultations: "r",
    prescriptions: "ru",
    stock: "rcu",
    achats: "rc",
    facturation: "rc",
    finances: "rc",
    relation: "rcu",
    formations: "rcu",
    documents: "rc",
    ia: "rc",
  },
  comptable: {
    dashboard: "r",
    clients: "r",
    facturation: "re",
    finances: "re",
    achats: "r",
    rapports: "re",
    documents: "r",
  },
  confrere: {
    dashboard: "r",
    patients: "r",
    consultations: "r",
    documents: "r",
  },
};

const LETTER: Record<PermAction, string> = {
  read: "r",
  create: "c",
  update: "u",
  validate: "v",
  export: "e",
  admin: "a",
};

/* Réglages du DG (paramètres) appliqués par-dessus la matrice par défaut. */
let OVERRIDES: Partial<Record<RoleId, Perms>> = {};
let LABELS: Partial<Record<RoleId, { label?: string; description?: string }>> = {};
export function applyRoleSettings(perms?: Partial<Record<RoleId, Partial<Record<string, string>>>>, labels?: Partial<Record<RoleId, { label?: string; description?: string }>>) {
  OVERRIDES = (perms ?? {}) as Partial<Record<RoleId, Perms>>;
  LABELS = labels ?? {};
}

export const defaultLetters = (role: RoleId, module: ModuleId) => MATRIX[role][module] ?? "";

export function letters(role: RoleId, module: ModuleId): string {
  // Cloison éditeur / clinique : l'éditeur ne voit que la plateforme, les cliniques jamais la console.
  if (module === "plateforme") return role === "editeur" ? ALL : "";
  if (role === "editeur") return "";
  // Le DG garde toujours l'administration (pas de verrouillage possible).
  if (role === "dg" && module === "admin") return ALL;
  return OVERRIDES[role]?.[module] ?? MATRIX[role][module] ?? "";
}

export function can(role: RoleId | undefined, module: ModuleId, action: PermAction = "read"): boolean {
  if (!role) return false;
  return letters(role, module).includes(LETTER[action]);
}

export const ACTION_LETTER = LETTER;

export function rolePermissions(role: RoleId): Perms {
  return Object.fromEntries((Object.keys(MODULE_LABELS) as ModuleId[]).map((m) => [m, letters(role, m)])) as Perms;
}

export const roleLabel = (r: RoleId) => LABELS[r]?.label || ROLE_LABELS[r];
export const roleDescription = (r: RoleId) => LABELS[r]?.description || ROLE_DESCRIPTIONS[r];

/** Rôles autorisés à valider un acte clinique. */
export const CLINICAL_VALIDATORS: RoleId[] = ["dg", "vet"];
/** Rôles pouvant être désignés vétérinaire responsable. */
export const RESPONSIBLE_VET_ROLES: RoleId[] = ["dg", "vet"];
