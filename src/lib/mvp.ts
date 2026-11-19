/**
 * Réglage unique du périmètre « version de test clinique » (MVP) en mode connecté.
 * En mode API (NEXT_PUBLIC_API_URL définie) :
 *  - can() renvoie false pour tout module absent de MVP_MODULES → les entrées
 *    de menu et les actions de ces modules disparaissent ;
 *  - les clés de MVP_HIDDEN_NAV_KEYS sont masquées dans la navigation même
 *    quand leur module parent est MVP (fonctionnalités hors périmètre).
 * Pour réactiver un module plus tard : l'ajouter à MVP_MODULES (et retirer
 * ses clés éventuelles de MVP_HIDDEN_NAV_KEYS). Aucun effet en mode démo.
 */
import type { ModuleId } from "./permissions";

/** Modules du périmètre MVP (docs/AUDIT.md §3.5 + brief de test clinique). */
export const MVP_MODULES: readonly ModuleId[] = [
  "dashboard",
  "agenda",
  "clients",
  "patients",
  "exploitations",
  "consultations",
  "prescriptions",
  "stock",
  "achats",
  "facturation",
  "finances",
  "rapports",
  "admin",
];

export const isMvpModule = (m: ModuleId): boolean => MVP_MODULES.includes(m);

/**
 * Entrées de menu (items ET sous-items, par `key` dans layout/navigation.tsx)
 * hors périmètre bien que rattachées à un module MVP.
 */
export const MVP_HIDDEN_NAV_KEYS: readonly string[] = [
  "approvals", // circuit d'approbation générique (approvalsService hors registre)
  "payables", // dettes fournisseurs (payablesService hors registre)
  "forecast", // prévisions d'achat (hors MVP — AUDIT §3.5)
  "projects", // projets (projectsService hors registre)
  "budgets", // budgets (budgetsService hors registre)
  "equipment", // matériel (equipmentService hors registre)
  "adminFiles", // dossiers administratifs (adminFilesService hors registre)
  "equipe", // fil d'équipe / réunions (teamService hors registre)
  "teamTasks", // tâches d'équipe (teamTasksService hors registre)
  "staffMgmt", // personnel RH (staffService hors registre)
  "protocols", // protocoles (protocolsService hors registre)
  "demo", // environnement de démonstration (localStorage, sans objet en mode API)
];

export const isMvpNavKey = (key: string): boolean => !MVP_HIDDEN_NAV_KEYS.includes(key);

/**
 * Ops exécutées localement en mode connecté mais JAMAIS envoyées au serveur.
 * Ce sont des dérivations/compteurs automatiques : si elles avançaient la
 * version partagée, chaque poste forcerait tous les autres à recharger en
 * boucle (mesuré : 332 ops/heure pour le seul scan d'alertes).
 * Choix pour la version de test : pas d'envoi du tout — le scan d'alertes
 * est redérivé localement par chaque poste, le suivi d'annonces et le
 * marquage « lu » sont cosmétiques. Pour réactiver une op côté serveur,
 * retirer son nom de la liste (la persistance dédiée viendra avec le backend).
 */
export const LOCAL_ONLY_API_OPS = new Set<string>([
  "alertes.scanner",
  "annonces.suivi",
  "notifications.lire",
]);
