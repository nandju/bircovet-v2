/** Protocoles et fiches internes du cabinet. */
import type { Protocol, ProtocolCategory } from "./types";

export const PROTOCOL_CATS: Record<ProtocolCategory, { label: string; desc: string; chip: string; dot: string }> = {
  prise_en_charge: { label: "Prise en charge", desc: "Conduite à tenir par pathologie", chip: "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-300", dot: "bg-error-500" },
  parcours_client: { label: "Parcours client", desc: "Du premier contact au suivi", chip: "bg-theme-pink-500/10 text-theme-pink-500", dot: "bg-theme-pink-500" },
  accueil: { label: "Accueil", desc: "Recevoir un client, le téléphone, le comptoir", chip: "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300", dot: "bg-brand-500" },
  avant_visite: { label: "Avant une visite", desc: "Préparer une sortie en élevage", chip: "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300", dot: "bg-orange-500" },
  avant_chirurgie: { label: "Avant une chirurgie", desc: "Préparation, bloc, réveil", chip: "bg-theme-purple-500/10 text-theme-purple-500", dot: "bg-theme-purple-500" },
  hygiene: { label: "Hygiène et biosécurité", desc: "Nettoyage, désinfection, déchets", chip: "bg-tertiary-50 text-tertiary-700 dark:bg-tertiary-500/15 dark:text-tertiary-300", dot: "bg-tertiary-500" },
  autre: { label: "Autre fiche", desc: "", chip: "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300", dot: "bg-gray-400" },
};

let k = 0;
const st = (text: string, critical = false) => ({ id: `st-${++k}`, text, critical });

/** Fiches de démonstration (à adapter et valider par le cabinet). */
export function demoProtocols(authorId: string, validatorId: string, at: string): Protocol[] {
  const base = { status: "valide" as const, version: 1, authorId, validatedById: validatorId, updatedAt: at };
  return [
    { ...base, id: "pro-1", code: "PRO-0001", category: "prise_en_charge", title: "Parvovirose canine suspectée", subject: "Gastro-entérite hémorragique du chiot", species: ["Chien"], summary: "Isoler, réhydrater, protéger l'équipe. Test rapide dès l'admission.", steps: [st("Isoler immédiatement le chiot (salle d'isolement), blouse et gants dédiés", true), st("Test rapide parvovirus sur selles"), st("Évaluer la déshydratation et poser une voie veineuse"), st("Fluidothérapie selon le protocole du vétérinaire", true), st("Antiémétique et antibiothérapie sur prescription"), st("Surveillance toutes les 4 h : température, vomissements, selles"), st("Informer le propriétaire du pronostic et du coût prévisionnel (devis)"), st("Désinfection à l'eau de Javel diluée après passage", true)], materials: ["Kit test parvovirus", "Perfuseur, cathéter 22–24 G", "Soluté", "Blouses et gants jetables", "Javel"], warnings: "Ne jamais hospitaliser à côté d'un chiot non vacciné.", links: [] },
    { ...base, id: "pro-2", code: "PRO-0002", category: "prise_en_charge", title: "Suspicion de maladie de Newcastle en élevage", subject: "Mortalités brutales, signes nerveux et respiratoires", species: ["Volaille"], summary: "Biosécurité d'abord, prélèvements, déclaration, conseils à l'éleveur.", steps: [st("Ne pas entrer sans tenue jetable ; pédiluve à l'entrée", true), st("Recenser mortalités par bande et par jour"), st("Autopsier 3 à 5 sujets, photographier les lésions"), st("Prélèvements pour le laboratoire (organes, écouvillons)"), st("Informer le DG — maladie à déclaration obligatoire", true), st("Interdire les sorties d'animaux et d'œufs en attendant les résultats"), st("Plan de vaccination des bandes saines"), st("Rédiger le rapport de visite le jour même avec photos")], materials: ["Combinaisons, bottes, masques", "Kit d'autopsie", "Glacière et tubes de prélèvement", "Désinfectant"], warnings: "Changer de tenue et désinfecter le véhicule avant toute autre visite.", links: [] },
    { ...base, id: "pro-3", code: "PRO-0003", category: "accueil", title: "Accueillir un client au cabinet", subject: "Premier contact au comptoir", species: [], summary: "Saluer, identifier, orienter, rassurer — en moins de 2 minutes.", steps: [st("Saluer le client par son nom s'il est connu, sourire"), st("Rechercher la fiche (téléphone) avant d'en créer une — pas de doublon", true), st("Demander le motif, noter le poids de l'animal"), st("Indiquer le temps d'attente estimé"), st("Urgence (saignement, détresse, convulsions) : prévenir le vétérinaire immédiatement", true), st("Proposer de l'eau ; animal en laisse ou en caisse"), st("Après la consultation : expliquer la facture et programmer le prochain rendez-vous")], materials: ["Balance", "Fiches d'accueil"], warnings: "", links: [] },
    { ...base, id: "pro-4", code: "PRO-0004", category: "parcours_client", title: "Parcours d'un nouvel éleveur", subject: "Du premier achat au client fidèle", species: ["Volaille", "Bovin", "Porcin"], summary: "Capter le cheptel au comptoir, proposer une visite, suivre à J3, J7, J30.", steps: [st("Au comptoir : enregistrer espèces, effectifs et lieu de la ferme"), st("Proposer une visite de diagnostic (offerte ou à tarif découverte)"), st("Lancer le plan de relances (J3, J7, J30)"), st("Après la visite : rapport + plan de prophylaxie chiffré"), st("Classer l'éleveur (petit / moyen / gros) et ajuster le suivi")], materials: [], warnings: "", links: [] },
    { ...base, id: "pro-5", code: "PRO-0005", category: "avant_visite", title: "Préparer une visite de ferme", subject: "Check-list véhicule et caisse terrain", species: [], summary: "Rien ne doit manquer sur le terrain.", steps: [st("Relire l'historique de l'exploitation et les actions en cours"), st("Appeler l'éleveur la veille (accès, effectifs, problème actuel)"), st("Préparer la caisse terrain : médicaments, vaccins (glacière), seringues", true), st("Transférer le stock vers la mission dans Cliva", true), st("Tenue : combinaison, bottes, masque, gants"), st("Ouvrir l'itinéraire Google Maps de l'exploitation"), st("Batterie du téléphone chargée pour les photos du rapport")], materials: ["Glacière + accumulateurs", "Thermomètre", "Kit d'autopsie", "Combinaisons"], warnings: "", links: [] },
    { ...base, id: "pro-6", code: "PRO-0006", category: "avant_chirurgie", title: "Préparation avant stérilisation", subject: "Ovariectomie chienne / chatte", species: ["Chien", "Chat"], summary: "Animal à jeun, consentement signé, bloc prêt.", steps: [st("Vérifier le jeûne (12 h solide, eau jusqu'à 2 h)", true), st("Consentement éclairé signé par le propriétaire", true), st("Pesée et examen pré-anesthésique"), st("Bilan sanguin si animal âgé ou à risque"), st("Préparer le bloc : instruments stérilisés, champs, fils"), st("Tondre et désinfecter le site opératoire"), st("Surveillance du réveil : température, couverture"), st("Remettre les consignes post-opératoires et le rendez-vous de contrôle")], materials: ["Boîte de chirurgie stérile", "Fils résorbables", "Champs stériles", "Collerette"], warnings: "Pas d'anesthésie sans consentement signé.", links: [] },
  ];
}

/** Lien Google (Drive, Docs, Sheets, Maps…) : type détecté pour l'icône et le libellé. */
export function linkKind(url: string): { label: string; tone: string } {
  const u = url.toLowerCase();
  if (u.includes("docs.google.com/document")) return { label: "Google Docs", tone: "bg-tertiary-50 text-tertiary-700 dark:bg-tertiary-500/15 dark:text-tertiary-300" };
  if (u.includes("docs.google.com/spreadsheets")) return { label: "Google Sheets", tone: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-300" };
  if (u.includes("docs.google.com/presentation")) return { label: "Google Slides", tone: "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-300" };
  if (u.includes("docs.google.com/forms") || u.includes("forms.gle")) return { label: "Google Forms", tone: "bg-theme-purple-500/10 text-theme-purple-500" };
  if (u.includes("drive.google.com")) return { label: "Google Drive", tone: "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-300" };
  if (u.includes("maps.app.goo.gl") || (u.includes("google.") && u.includes("/maps"))) return { label: "Google Maps", tone: "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-300" };
  if (u.includes("youtube.com") || u.includes("youtu.be")) return { label: "Vidéo", tone: "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-300" };
  return { label: "Lien", tone: "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300" };
}

export const isHttpUrl = (u: string) => /^https?:\/\/[^\s]+\.[^\s]+/i.test(u.trim());
