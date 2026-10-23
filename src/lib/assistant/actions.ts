import { can, type ModuleId } from "../permissions";
import type { RoleId } from "../types";

/**
 * Catalogue central des actions de navigation de Mini Marc.
 * L'IA sélectionne une CLÉ de ce catalogue — elle ne génère jamais d'URL.
 * Chaque clé pointe vers une route réelle de l'application et déclare le
 * module de permission requis. Validé côté serveur avant d'être affiché.
 */
export interface AssistantAction {
  /** Clé stable renvoyée par le modèle. */
  key: string;
  /** Libellé du bouton affiché à l'utilisateur. */
  label: string;
  /** Description courte pour guider le choix du modèle. */
  hint: string;
  /** Destination réelle (route de l'application). */
  path: string;
  /** Module dont la permission "read" est requise. */
  module: ModuleId;
}

export const ASSISTANT_ACTIONS: AssistantAction[] = [
  { key: "dashboard", label: "Tableau de bord", hint: "Vue d'ensemble, indicateurs", path: "/", module: "dashboard" },
  { key: "agenda", label: "Ouvrir l'agenda", hint: "Rendez-vous du jour", path: "/agenda", module: "agenda" },
  { key: "queue", label: "File d'attente", hint: "Patients en attente à l'accueil", path: "/agenda/file-attente", module: "agenda" },
  { key: "clients.list", label: "Liste des clients", hint: "Propriétaires d'animaux", path: "/clients", module: "clients" },
  { key: "clients.new", label: "Ajouter un client / patient", hint: "Créer un client ou un patient", path: "/clients/nouveau", module: "clients" },
  { key: "patients.list", label: "Liste des patients", hint: "Dossiers des animaux", path: "/patients", module: "patients" },
  { key: "farms.list", label: "Exploitations agricoles", hint: "Fermes, élevages, bâtiments", path: "/exploitations", module: "exploitations" },
  { key: "consultations.list", label: "Consultations", hint: "Historique des consultations", path: "/consultations", module: "consultations" },
  { key: "consultations.new", label: "Nouvelle consultation", hint: "Démarrer une consultation", path: "/consultations/nouvelle", module: "consultations" },
  { key: "prescriptions", label: "Prescriptions et délivrances", hint: "Ordonnances", path: "/prescriptions", module: "prescriptions" },
  { key: "hospitalisation", label: "Hospitalisation", hint: "Animaux hospitalisés", path: "/hospitalisation", module: "hospitalisation" },
  { key: "missions.list", label: "Missions terrain", hint: "Interventions, visites d'exploitation, domicile", path: "/missions", module: "missions" },
  { key: "stock.overview", label: "Ouvrir la pharmacie", hint: "Stock, vue générale", path: "/stock", module: "stock" },
  { key: "stock.catalog", label: "Catalogue produits", hint: "Articles, notices", path: "/stock/catalogue", module: "stock" },
  { key: "stock.lots", label: "Lots et péremptions", hint: "Lots FEFO, dates d'expiration", path: "/stock/lots", module: "stock" },
  { key: "stock.movements", label: "Mouvements de stock", hint: "Entrées et sorties", path: "/stock/mouvements", module: "stock" },
  { key: "stock.inventories", label: "Inventaires", hint: "Comptages", path: "/stock/inventaires", module: "stock" },
  { key: "stock.transfers", label: "Transferts de stock", hint: "Entre établissements", path: "/stock/transferts", module: "stock" },
  { key: "stock.consignments", label: "Dépôts-vente", hint: "Produits confiés en consignation", path: "/stock/depots", module: "stock" },
  { key: "stock.calculator", label: "Calculateur de conseil", hint: "Aide au calcul de dose (notices)", path: "/stock/calculateur", module: "stock" },
  { key: "stock.alerts", label: "Alertes stock", hint: "Stock faible, péremptions", path: "/stock/alertes", module: "stock" },
  { key: "purchases.orders", label: "Commandes fournisseurs", hint: "Achats, approvisionnement", path: "/achats", module: "achats" },
  { key: "purchases.receptions", label: "Réceptions", hint: "Réceptionner une livraison", path: "/achats/receptions", module: "achats" },
  { key: "purchases.suppliers", label: "Fournisseurs", hint: "Liste des fournisseurs", path: "/achats/fournisseurs", module: "achats" },
  { key: "billing.invoices", label: "Factures", hint: "Factures du mois, impayés", path: "/facturation", module: "facturation" },
  { key: "billing.quotes", label: "Devis", hint: "Créer ou suivre un devis", path: "/facturation/devis", module: "facturation" },
  { key: "billing.proforma", label: "Factures pro forma", hint: "Documents commerciaux non engageants", path: "/facturation/proforma", module: "facturation" },
  { key: "billing.creditNotes", label: "Avoirs", hint: "Notes de crédit", path: "/facturation/avoirs", module: "facturation" },
  { key: "finance.payments", label: "Encaissements", hint: "Enregistrer un paiement", path: "/finances/encaissements", module: "finances" },
  { key: "finance.expenses", label: "Dépenses", hint: "Enregistrer une dépense, caisse", path: "/finances/depenses", module: "finances" },
  { key: "finance.accounts", label: "Comptes et caisse", hint: "Trésorerie", path: "/finances/comptes", module: "finances" },
  { key: "crm.tasks", label: "Relation client et tâches", hint: "Suivi clients, relances", path: "/relation-client", module: "relation" },
  { key: "crm.reminders", label: "Rappels et messages", hint: "Relances, rappels vaccinaux", path: "/relation-client/rappels", module: "relation" },
  { key: "team", label: "Espace équipe", hint: "Messages internes, réunions", path: "/equipe", module: "dashboard" },
  { key: "trainings", label: "Formations", hint: "Sessions, inscriptions", path: "/formations", module: "formations" },
  { key: "documents", label: "Documents", hint: "Fichiers, protocoles, modèles", path: "/documents", module: "documents" },
  { key: "reports", label: "Rapports et statistiques", hint: "Indicateurs, analyses", path: "/rapports", module: "rapports" },
  { key: "assistant", label: "Assistant IA (page)", hint: "Brouillons IA détaillés", path: "/assistant-ia", module: "ia" },
  { key: "admin.settings", label: "Paramètres", hint: "Configuration, personnalisation, logo, couleurs", path: "/administration/parametres", module: "admin" },
  { key: "admin.users", label: "Utilisateurs", hint: "Comptes du personnel", path: "/administration/utilisateurs", module: "admin" },
  { key: "admin.licences", label: "Licences", hint: "Échéances et paiements de licence", path: "/administration/licences", module: "admin" },
  { key: "admin.audit", label: "Journal d'activité", hint: "Historique des actions", path: "/administration/journal", module: "admin" },
];

const BY_KEY = new Map(ASSISTANT_ACTIONS.map((a) => [a.key, a]));

/** Valide une clé renvoyée par le modèle et vérifie la permission du rôle (matrice simulée de démo). */
export function resolveAction(key: string | undefined, roleId: RoleId | undefined): AssistantAction | null {
  if (!key) return null;
  const action = BY_KEY.get(key);
  if (!action) return null;
  if (!can(roleId, action.module, "read")) return null;
  return action;
}

/** Catalogue transmis au modèle : clés + descriptions uniquement, déjà filtré par permissions. */
export function catalogForModel(roleId: RoleId | undefined): { key: string; label: string; hint: string }[] {
  return ASSISTANT_ACTIONS.filter((a) => can(roleId, a.module, "read")).map(({ key, label, hint }) => ({ key, label, hint }));
}

/** Clés valides, indépendamment des permissions (validation stricte). */
export function isKnownActionKey(key: string): boolean {
  return BY_KEY.has(key);
}
