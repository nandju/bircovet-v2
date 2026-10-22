import type { ModuleId } from "./permissions";

/**
 * Mini Marc — moteur local d'intentions (démonstration, sans service IA externe).
 * Les destinations proviennent exclusivement des routes réelles de l'application.
 * Point d'intégration futur : remplacer `matchIntents` par un appel à un service
 * NLU (ex. API maison ou LLM) en conservant les mêmes types de retour.
 */

export interface IntentAction {
  label: string;
  path: string;
  /** Module requis pour la lecture — filtré par les permissions de l'utilisateur. */
  module?: ModuleId;
}

export interface Intent {
  /** Message de confirmation affiché à l'utilisateur. */
  response: string;
  keywords: string[];
  actions: IntentAction[];
}

const INTENTS: Intent[] = [
  {
    response: "Vous souhaitez enregistrer un nouveau client ou patient.",
    keywords: ["nouveau patient", "ajouter un patient", "enregistrer un patient", "nouveau client", "ajouter un client", "fiche client", "fiche patient", "créer un patient", "créer un client"],
    actions: [
      { label: "Ouvrir les clients", path: "/clients", module: "clients" },
      { label: "Ajouter un client / patient", path: "/clients/nouveau", module: "clients" },
    ],
  },
  {
    response: "Voici les écrans de la pharmacie et du stock.",
    keywords: ["pharmacie", "stock", "médicament", "médicaments", "produit", "produits", "péremption", "péremptions", "lots", "lot"],
    actions: [
      { label: "Ouvrir le stock", path: "/stock", module: "stock" },
      { label: "Catalogue produits", path: "/stock/catalogue", module: "stock" },
      { label: "Lots et péremptions", path: "/stock/lots", module: "stock" },
      { label: "Alertes stock", path: "/stock/alertes", module: "stock" },
    ],
  },
  {
    response: "Vous souhaitez préparer une mission d'exploitation ou à domicile.",
    keywords: ["mission", "missions", "intervention", "visite ferme", "visite exploitation", "domicile", "élevage", "déplacement", "terrain"],
    actions: [
      { label: "Ouvrir les missions", path: "/missions", module: "missions" },
      { label: "Exploitations agricoles", path: "/exploitations", module: "exploitations" },
    ],
  },
  {
    response: "Voici les factures et la facturation.",
    keywords: ["facture", "factures", "facturation", "devis", "avoir", "avoirs", "impayé", "impayés"],
    actions: [
      { label: "Factures", path: "/facturation", module: "facturation" },
      { label: "Devis", path: "/facturation/devis", module: "facturation" },
      { label: "Avoirs", path: "/facturation/avoirs", module: "facturation" },
    ],
  },
  {
    response: "Une dépense s'enregistre dans les finances.",
    keywords: ["dépense", "dépenses", "sortie de caisse", "caisse", "loyer", "achat fourniture"],
    actions: [
      { label: "Dépenses", path: "/finances/depenses", module: "finances" },
      { label: "Comptes et caisse", path: "/finances/comptes", module: "finances" },
    ],
  },
  {
    response: "Voici les encaissements et le règlement des factures.",
    keywords: ["encaisser", "encaissement", "paiement", "règlement", "mobile money", "payer une facture", "espèces", "versement"],
    actions: [
      { label: "Encaissements", path: "/finances/encaissements", module: "finances" },
      { label: "Factures", path: "/facturation", module: "facturation" },
    ],
  },
  {
    response: "Voici les exploitations agricoles et leurs troupeaux.",
    keywords: ["exploitation", "exploitations", "ferme", "fermes", "troupeau", "poulailler", "bâtiment", "effectifs"],
    actions: [{ label: "Exploitations", path: "/exploitations", module: "exploitations" }],
  },
  {
    response: "Voici l'agenda, les rendez-vous et la file d'attente.",
    keywords: ["rendez-vous", "rdv", "agenda", "planning", "file d'attente", "salle d'attente", "horaire"],
    actions: [
      { label: "Agenda", path: "/agenda", module: "agenda" },
      { label: "File d'attente", path: "/agenda/file-attente", module: "agenda" },
    ],
  },
  {
    response: "Voici les consultations et ordonnances.",
    keywords: ["consultation", "consultations", "ordonnance", "prescription", "prescriptions", "soigner", "anamnèse"],
    actions: [
      { label: "Consultations", path: "/consultations", module: "consultations" },
      { label: "Nouvelle consultation", path: "/consultations/nouvelle", module: "consultations" },
      { label: "Ordonnances", path: "/prescriptions", module: "prescriptions" },
    ],
  },
  {
    response: "Voici les hospitalisations.",
    keywords: ["hospitalisation", "hospitalisé", "hospitalisés", "garder un animal", "box"],
    actions: [{ label: "Hospitalisation", path: "/hospitalisation", module: "hospitalisation" }],
  },
  {
    response: "Voici les commandes fournisseurs et les réceptions.",
    keywords: ["commande", "commandes", "fournisseur", "fournisseurs", "réception", "réceptions", "approvisionnement", "acheter"],
    actions: [
      { label: "Commandes", path: "/achats", module: "achats" },
      { label: "Réceptions", path: "/achats/receptions", module: "achats" },
      { label: "Fournisseurs", path: "/achats/fournisseurs", module: "achats" },
    ],
  },
  {
    response: "Voici les rappels, tâches et le suivi des clients.",
    keywords: ["rappel", "rappels", "relance", "relances", "client inactif", "tâche", "tâches", "suivi client", "rappel vaccin"],
    actions: [
      { label: "Relation client", path: "/relation-client", module: "relation" },
      { label: "Rappels", path: "/relation-client/rappels", module: "relation" },
    ],
  },
  {
    response: "Voici les rapports et indicateurs.",
    keywords: ["rapport", "rapports", "statistiques", "indicateurs", "chiffre d'affaires", "bilan", "analyse", "vendus"],
    actions: [{ label: "Rapports", path: "/rapports", module: "rapports" }],
  },
  {
    response: "Voici les formations et inscriptions.",
    keywords: ["formation", "formations", "inscription formation", "fdfp"],
    actions: [{ label: "Formations", path: "/formations", module: "formations" }],
  },
  {
    response: "Voici les paramètres et l'administration.",
    keywords: ["paramètre", "paramètres", "utilisateur", "utilisateurs", "rôle", "permissions", "personnalisation", "logo", "couleurs", "administration"],
    actions: [
      { label: "Paramètres", path: "/administration/parametres", module: "admin" },
      { label: "Utilisateurs", path: "/administration/utilisateurs", module: "admin" },
      { label: "Rôles", path: "/administration/roles", module: "admin" },
    ],
  },
  {
    response: "Voici l'espace documents.",
    keywords: ["document", "documents", "fichier", "fichiers", "protocole", "modèle"],
    actions: [{ label: "Documents", path: "/documents", module: "documents" }],
  },
  {
    response: "Voici les factures pro forma — documents commerciaux non engageants.",
    keywords: ["pro forma", "proforma", "facture pro forma"],
    actions: [{ label: "Factures pro forma", path: "/facturation/proforma", module: "facturation" }],
  },
  {
    response: "Voici le suivi des produits en dépôt-vente — distincts des ventes encaissées.",
    keywords: ["dépôt-vente", "depot vente", "dépôts", "consignation", "dépositaire", "en dépôt"],
    actions: [{ label: "Dépôts-vente", path: "/stock/depots", module: "stock" }],
  },
  {
    response: "Voici le calculateur d'aide au conseil — il n'utilise que les dosages documentés des notices, à valider par le vétérinaire.",
    keywords: ["calculateur", "calcul dose", "dosage", "posologie", "conversion", "dose par kg"],
    actions: [
      { label: "Calculateur de conseil", path: "/stock/calculateur", module: "stock" },
      { label: "Catalogue produits", path: "/stock/catalogue", module: "stock" },
    ],
  },
  {
    response: "Voici l'espace d'échange de l'équipe — messages, réunions et suivi des actions.",
    keywords: ["équipe", "réunion", "compte rendu", "message interne", "personnel", "staff"],
    actions: [{ label: "Espace équipe", path: "/equipe", module: "dashboard" }],
  },
  {
    response: "Voici le suivi des licences et échéances.",
    keywords: ["licence", "licences", "abonnement", "échéance licence"],
    actions: [{ label: "Licences", path: "/administration/licences", module: "admin" }],
  },
];

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** Associe une demande en langage naturel aux intentions connues, par score décroissant. */
export function matchIntents(query: string, max = 2): Intent[] {
  const q = normalize(query);
  const scored = INTENTS.map((i) => {
    const score = i.keywords.reduce((acc, k) => (q.includes(normalize(k)) ? acc + normalize(k).length : acc), 0);
    return { i, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.i);
  return scored.slice(0, max);
}

/** Libellés des routes principales (pages récentes, réponses de Mini Marc). */
export const PATH_LABELS: Record<string, string> = {
  "/": "Tableau de bord",
  "/clients": "Clients",
  "/clients/nouveau": "Nouveau client",
  "/patients": "Patients",
  "/exploitations": "Exploitations",
  "/agenda": "Agenda",
  "/agenda/file-attente": "File d'attente",
  "/consultations": "Consultations",
  "/consultations/nouvelle": "Nouvelle consultation",
  "/prescriptions": "Ordonnances",
  "/hospitalisation": "Hospitalisation",
  "/stock": "Stock",
  "/stock/catalogue": "Catalogue produits",
  "/stock/lots": "Lots",
  "/stock/mouvements": "Mouvements de stock",
  "/stock/inventaires": "Inventaires",
  "/stock/transferts": "Transferts",
  "/stock/corrections": "Corrections de stock",
  "/stock/alertes": "Alertes stock",
  "/achats": "Commandes",
  "/achats/receptions": "Réceptions",
  "/achats/fournisseurs": "Fournisseurs",
  "/facturation": "Facturation",
  "/facturation/devis": "Devis",
  "/facturation/avoirs": "Avoirs",
  "/facturation/regroupee": "Facturation regroupée",
  "/finances": "Finances",
  "/finances/encaissements": "Encaissements",
  "/finances/depenses": "Dépenses",
  "/finances/comptes": "Comptes",
  "/finances/credits": "Crédits",
  "/finances/creances": "Créances",
  "/missions": "Missions",
  "/relation-client": "Relation client",
  "/relation-client/rappels": "Rappels",
  "/relation-client/interactions": "Interactions",
  "/formations": "Formations",
  "/documents": "Documents",
  "/rapports": "Rapports",
  "/assistant-ia": "Assistant IA",
  "/administration/parametres": "Paramètres",
  "/profil": "Profil",
};

const RECENT_KEY = "cliva.recent-pages";

/** Mémorise les dernières pages consultées (session navigateur uniquement). */
export function trackPageVisit(pathname: string) {
  if (typeof sessionStorage === "undefined" || pathname === "/signin") return;
  try {
    const list: string[] = JSON.parse(sessionStorage.getItem(RECENT_KEY) ?? "[]");
    const next = [pathname, ...list.filter((p) => p !== pathname)].slice(0, 5);
    sessionStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* stockage indisponible */
  }
}

export function getRecentPages(): { path: string; label: string }[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const list: string[] = JSON.parse(sessionStorage.getItem(RECENT_KEY) ?? "[]");
    return list.map((path) => ({ path, label: PATH_LABELS[path] ?? path }));
  } catch {
    return [];
  }
}

export const SUGGESTIONS = [
  "Je veux enregistrer un nouveau patient",
  "Ouvre la pharmacie",
  "Je veux créer une mission à domicile",
  "Montre-moi les factures",
  "Où enregistrer une dépense ?",
  "Consulter les exploitations agricoles",
];

/* ------------------------------------------------------------------ */
/* Ciblage de champ pour l'insertion contrôlée de texte dicté.         */
/* ------------------------------------------------------------------ */

let lastEditable: HTMLInputElement | HTMLTextAreaElement | null = null;

const isEditable = (el: EventTarget | null): el is HTMLInputElement | HTMLTextAreaElement => {
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  if (el instanceof HTMLInputElement) return ["text", "search", "url", "tel", "email", "number", "date", "datetime-local"].includes(el.type) && !el.readOnly && !el.disabled;
  return false;
};

/** À appeler une fois (client) : mémorise le dernier champ de texte ciblé par l'utilisateur. */
export function installFieldTracker() {
  if (typeof document === "undefined") return;
  document.addEventListener(
    "focusin",
    (e) => {
      if (isEditable(e.target)) lastEditable = e.target;
    },
    true
  );
}

export function getTargetField(): HTMLInputElement | HTMLTextAreaElement | null {
  return lastEditable && document.contains(lastEditable) && !lastEditable.disabled && !lastEditable.readOnly ? lastEditable : null;
}

export function describeTarget(el: HTMLElement): string {
  const id = el.closest("[id]")?.id;
  const aria = el.getAttribute("aria-label");
  const name = el.getAttribute("name");
  const placeholder = el.getAttribute("placeholder");
  return aria || placeholder || name || (id ? `#${id}` : "champ de texte");
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

export interface InsertionResult {
  ok: boolean;
  message: string;
  /** Snapshot permettant d'annuler l'insertion. */
  undo?: () => void;
}

/**
 * Insère un texte dans le dernier champ ciblé. Jamais silencieux :
 * l'utilisateur choisit « ajouter » ou « remplacer », l'action est annulable.
 */
export function insertIntoTarget(text: string, mode: "append" | "replace"): InsertionResult {
  const el = getTargetField();
  const t = text.trim();
  if (!el) return { ok: false, message: "Aucun champ de formulaire n'a été ciblé. Cliquez d'abord dans un champ de texte." };
  if (!t) return { ok: false, message: "Aucun texte à insérer." };
  const previous = el.value;
  setNativeValue(el, mode === "replace" ? t : previous ? `${previous}${previous.endsWith(" ") || previous.endsWith("\n") ? "" : " "}${t}` : t);
  el.focus();
  return {
    ok: true,
    message: mode === "replace" ? `Texte inséré dans ${describeTarget(el)} (contenu remplacé).` : `Texte ajouté dans ${describeTarget(el)}.`,
    undo: () => {
      if (document.contains(el)) {
        setNativeValue(el, previous);
        el.focus();
      }
    },
  };
}
