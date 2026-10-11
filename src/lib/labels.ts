/** Libellés métier (fr) et couleurs de badge associées aux statuts. */

export type Tone = "primary" | "success" | "error" | "warning" | "info" | "light" | "dark";
export type LabelMap = Record<string, { label: string; tone: Tone }>;

const m = (o: Record<string, [string, Tone]>): LabelMap =>
  Object.fromEntries(Object.entries(o).map(([k, [label, tone]]) => [k, { label, tone }]));

export const STATUS = {
  client: m({ actif: ["Actif", "success"], archive: ["Archivé", "light"] }),
  clientType: m({ particulier: ["Particulier", "info"], entreprise: ["Entreprise", "primary"] }),
  segment: m({
    standard: ["Standard", "light"],
    premium: ["Premium", "primary"],
    eleveur: ["Éleveur", "success"],
    professionnel: ["Professionnel", "info"],
  }),
  vital: m({ vivant: ["Vivant", "success"], decede: ["Décédé", "dark"] }),
  sex: m({
    male: ["Mâle", "info"],
    femelle: ["Femelle", "primary"],
    male_castre: ["Mâle castré", "info"],
    femelle_sterilisee: ["Femelle stérilisée", "primary"],
    inconnu: ["Inconnu", "light"],
  }),
  farm: m({ actif: ["Active", "success"], inactif: ["Inactive", "light"], suspendu: ["Suspendue", "warning"] }),
  farmType: m({
    avicole: ["Avicole", "warning"],
    bovin: ["Bovin", "primary"],
    porcin: ["Porcin", "error"],
    ovin_caprin: ["Ovin / caprin", "info"],
    piscicole: ["Piscicole", "info"],
    mixte: ["Mixte", "light"],
  }),
  appointment: m({
    planifie: ["Planifié", "info"],
    confirme: ["Confirmé", "primary"],
    honore: ["Honoré", "success"],
    annule: ["Annulé", "error"],
    absent: ["Absent", "warning"],
  }),
  queue: m({
    attendu: ["Attendu", "light"],
    arrive: ["Arrivé", "info"],
    regle: ["Consultation réglée", "primary"],
    en_consultation: ["En consultation", "warning"],
    termine: ["Terminé", "success"],
    annule: ["Annulé", "error"],
  }),
  clinical: m({
    brouillon: ["Brouillon", "light"],
    a_valider: ["En attente de validation", "warning"],
    valide: ["Validé", "success"],
  }),
  financial: m({
    non_regle: ["Non réglé", "error"],
    regle_avance: ["Réglé d'avance", "success"],
    exception_demandee: ["Exception demandée", "warning"],
    exception_approuvee: ["Exception DG approuvée", "info"],
    facture: ["Facturé", "primary"],
  }),
  prescription: m({
    brouillon: ["Brouillon", "light"],
    a_valider: ["À valider", "warning"],
    validee: ["Validée", "info"],
    partiellement_delivree: ["Partiellement délivrée", "warning"],
    delivree: ["Délivrée", "success"],
    annulee: ["Annulée", "error"],
  }),
  hospitalization: m({
    en_cours: ["Séjour en cours", "warning"],
    sortie_medicale: ["Sortie médicale", "info"],
    cloture: ["Clôturé", "success"],
  }),
  mission: m({
    brouillon: ["Brouillon", "light"],
    planifiee: ["Planifiée", "info"],
    en_cours: ["En cours", "warning"],
    terminee: ["Terminée", "success"],
    annulee: ["Annulée", "error"],
  }),
  lot: m({
    disponible: ["Disponible", "success"],
    reserve: ["Réservé", "info"],
    quarantaine: ["En quarantaine", "warning"],
    perime: ["Périmé", "error"],
  }),
  product: m({ actif: ["Actif", "success"], inactif: ["Inactif", "light"] }),
  category: m({
    medicament: ["Médicament", "primary"],
    vaccin: ["Vaccin", "info"],
    antiparasitaire: ["Antiparasitaire", "warning"],
    consommable: ["Consommable", "light"],
    aliment: ["Aliment", "success"],
    materiel: ["Matériel", "dark"],
  }),
  movement: m({
    reception: ["Réception", "success"],
    delivrance: ["Délivrance", "primary"],
    administration: ["Administration", "primary"],
    transfert_sortie: ["Transfert sortant", "info"],
    transfert_entree: ["Transfert entrant", "info"],
    mission_sortie: ["Sortie mission", "info"],
    mission_retour: ["Retour mission", "success"],
    perte: ["Perte", "error"],
    retour_fournisseur: ["Retour fournisseur", "warning"],
    correction: ["Correction", "warning"],
    inventaire: ["Écart d'inventaire", "warning"],
  }),
  correction: m({ proposee: ["Proposée", "warning"], validee: ["Validée", "success"], rejetee: ["Rejetée", "error"] }),
  inventory: m({ en_cours: ["En cours", "info"], propose: ["Écarts proposés", "warning"], valide: ["Validé", "success"] }),
  supplier: m({ actif: ["Actif", "success"], inactif: ["Inactif", "light"] }),
  po: m({
    brouillon: ["Brouillon", "light"],
    envoyee: ["Commande envoyée (simulée)", "info"],
    partiellement_recue: ["Partiellement reçue", "warning"],
    recue: ["Reçue", "success"],
    cloturee: ["Clôturée", "dark"],
    annulee: ["Annulée", "error"],
  }),
  reception: m({ proposee: ["Proposée", "warning"], validee: ["Validée", "success"], rejetee: ["Rejetée", "error"] }),
  quote: m({
    brouillon: ["Brouillon", "light"],
    envoye: ["Envoyé (simulé)", "info"],
    accepte: ["Accepté", "success"],
    refuse: ["Refusé", "error"],
    converti: ["Converti en facture", "primary"],
  }),
  invoice: m({
    brouillon: ["Brouillon", "light"],
    a_valider: ["À valider", "warning"],
    validee: ["Validée", "info"],
    partiellement_payee: ["Partiellement payée", "warning"],
    payee: ["Payée", "success"],
    en_retard: ["En retard", "error"],
    annulee: ["Annulée", "dark"],
  }),
  paymentMethod: m({
    especes: ["Espèces", "success"],
    mobile_money: ["Mobile Money (simulé)", "warning"],
    carte: ["Carte (simulée)", "info"],
    virement: ["Virement (simulé)", "primary"],
    cheque: ["Chèque", "light"],
  }),
  paymentKind: m({
    reglement: ["Règlement", "success"],
    acompte: ["Acompte", "info"],
    ancienne_creance: ["Ancienne créance", "warning"],
  }),
  account: m({ caisse: ["Caisse", "success"], banque: ["Banque (simulée)", "primary"], mobile_money: ["Mobile Money (simulé)", "warning"] }),
  expense: m({ en_attente: ["En attente de validation", "warning"], approuvee: ["Approuvée", "success"], rejetee: ["Rejetée", "error"] }),
  credit: m({ en_attente: ["En attente DG", "warning"], approuve: ["Approuvé", "success"], refuse: ["Refusé", "error"] }),
  task: m({ a_faire: ["À faire", "light"], en_cours: ["En cours", "info"], en_attente: ["En attente", "warning"], termine: ["Terminé", "success"] }),
  priority: m({ basse: ["Basse", "light"], normale: ["Normale", "info"], haute: ["Haute", "warning"], urgente: ["Urgente", "error"] }),
  taskCategory: m({
    rappel: ["Rappel client", "info"],
    impaye: ["Suivi d'impayé", "error"],
    suivi_consultation: ["Suivi consultation", "primary"],
    suivi_hospitalisation: ["Suivi hospitalisation", "warning"],
    relance_inactif: ["Client inactif", "light"],
    administratif: ["Administratif", "dark"],
  }),
  session: m({
    planifiee: ["Planifiée", "info"],
    ouverte: ["Inscriptions ouvertes", "success"],
    complete: ["Complète", "warning"],
    terminee: ["Terminée", "dark"],
    annulee: ["Annulée", "error"],
  }),
  docCategory: m({
    rapport: ["Rapport", "primary"],
    analyse: ["Analyse", "info"],
    radiographie: ["Radiographie", "dark"],
    compte_rendu: ["Compte rendu", "success"],
    consentement: ["Consentement", "warning"],
    ordonnance: ["Ordonnance", "primary"],
    administratif: ["Administratif", "light"],
  }),
  doc: m({ actif: ["Actif", "success"], archive: ["Archivé", "light"] }),
  sync: m({ synchronise: ["Synchronisé", "success"], en_attente: ["En attente de synchronisation", "warning"], conflit: ["Conflit", "error"] }),
  user: m({ true: ["Actif", "success"], false: ["Désactivé", "light"] }),
} satisfies Record<string, LabelMap>;

export type StatusKind = keyof typeof STATUS;

export function labelOf(kind: StatusKind, value: string | undefined | null): string {
  if (value == null) return "—";
  return (STATUS[kind] as LabelMap)[value]?.label ?? value;
}

export function optionsOf(kind: StatusKind): { value: string; label: string }[] {
  return Object.entries(STATUS[kind] as LabelMap).map(([value, v]) => ({ value, label: v.label }));
}

export const SPECIES = [
  "Chien",
  "Chat",
  "Bovin",
  "Ovin",
  "Caprin",
  "Porcin",
  "Volaille",
  "Lapin",
  "Équidé",
  "NAC",
];
