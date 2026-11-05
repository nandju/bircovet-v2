/**
 * Aide contextuelle : pour chaque page, à quoi elle sert et comment faire, en mots simples.
 * Les tutoriels vidéo liés sont retrouvés par leur `routes`.
 */
export interface PageHelp {
  title: string;
  what: string;
  steps: string[];
  tip?: string;
}

const H: Record<string, PageHelp> = {
  "/": {
    title: "Vue d'ensemble",
    what: "Votre tableau de bord : ce qui se passe aujourd'hui et ce qui attend une action.",
    steps: ["Choisissez l'onglet Clinique, Rural ou Gestion selon ce que vous voulez voir.", "La carte « À traiter maintenant » liste ce qui est urgent : cliquez sur une ligne pour y aller.", "Les gros boutons verts lancent les actions les plus courantes."],
    tip: "Perdu ? Le bouton « Que voulez-vous faire ? » en haut propose les tâches en mots simples.",
  },
  "/agenda": {
    title: "Agenda",
    what: "Tous les rendez-vous de la clinique, par jour ou par semaine.",
    steps: ["Cliquez sur une case vide de l'agenda pour créer un rendez-vous à cette heure.", "Choisissez le client, l'animal, le vétérinaire et le motif, puis « Créer ».", "Cliquez sur un rendez-vous pour le déplacer, le confirmer ou l'annuler."],
    tip: "Un rendez-vous en pointillés attend l'accord du vétérinaire.",
  },
  "/agenda/file-attente": {
    title: "File d'attente",
    what: "Qui est arrivé, qui attend, qui est en consultation, aujourd'hui.",
    steps: ["Quand le client arrive, cliquez « Arrivé ».", "Le vétérinaire clique « En consultation » quand il le reçoit.", "À la fin, « Terminé » libère la place."],
  },
  "/agenda/demandes": {
    title: "Demandes de rendez-vous",
    what: "Les rendez-vous pris par l'équipe pour votre agenda attendent votre accord.",
    steps: ["Regardez votre journée affichée sous la demande : en rouge, ce qui chevauche.", "« Accepter » confirme le rendez-vous.", "« Proposer un autre horaire » le déplace ; « Refuser » demande un motif.", "Le collaborateur est prévenu et rappelle le client."],
  },
  "/clients": {
    title: "Clients",
    what: "L'annuaire de tous vos clients, avec leurs animaux, factures et relances.",
    steps: ["Tapez un nom ou un numéro dans la recherche.", "Cliquez sur un client pour ouvrir sa fiche complète.", "« Nouveau client » pour l'enregistrer."],
  },
  "/patients": {
    title: "Patients",
    what: "Les animaux suivis, avec leur dossier médical.",
    steps: ["Un nouveau client avec son animal ? « Enregistrement rapide » : nom, téléphone, nom de l'animal, espèce. C'est tout.", "Complétez la fiche plus tard : un bandeau orange vous le rappelle.", "Cliquez sur un animal pour voir ses consultations, vaccins et poids."],
  },
  "/consultations/nouvelle": {
    title: "Nouvelle consultation",
    what: "Le compte rendu de l'examen, les actes réalisés et la facture.",
    steps: ["Choisissez l'animal.", "Remplissez le motif, l'examen et le diagnostic.", "Ajoutez les actes et produits : la facture se prépare toute seule.", "Validez pour enregistrer."],
  },
  "/consultations/domicile": {
    title: "Consultations à domicile",
    what: "Les urgences et visites chez le client.",
    steps: ["« Nouvelle visite à domicile » : choisissez Urgence ou À la demande.", "L'adresse et le téléphone du client se remplissent seuls ; collez le lien Google Maps si vous l'avez.", "Sur place : « Départ », « Arrivée », puis « Démarrer la consultation »."],
  },
  "/stock/vente": {
    title: "Vente au comptoir",
    what: "Vendre des produits de la pharmacie, avec ou sans fiche client.",
    steps: ["Choisissez : Déjà client, Nouveau, ou De passage (notez son téléphone si possible).", "Cherchez le produit et ajoutez-le au panier.", "Choisissez le paiement (espèces, Mobile Money…) puis « Valider la vente »."],
    tip: "Le stock sort automatiquement, en commençant par les lots qui périment le plus tôt.",
  },
  "/stock": {
    title: "Pharmacie et stock",
    what: "Le chiffre de la pharmacie, la valeur du stock et ce qui manque.",
    steps: ["En haut : le chiffre d'affaires du jour, d'hier, du mois ou de l'année.", "Les cartes signalent le stock faible et les péremptions proches.", "Cliquez sur un rayon pour voir ses articles."],
  },
  "/stock/catalogue": {
    title: "Catalogue des articles",
    what: "La liste de tous les produits vendus ou utilisés, avec leurs prix.",
    steps: ["« Nouvel article » pour ajouter un produit.", "Le DG range les produits avec « Gérer les catégories »."],
  },
  "/stock/index-therapeutique": {
    title: "Index thérapeutique",
    what: "Vos posologies de référence par espèce : molécule, indication, dose, voie et AMM, consultables en quelques secondes.",
    steps: ["Cherchez une molécule ou une indication (ex. « sédation »), ou touchez une lettre.", "Filtrez par espèce si l'index en contient plusieurs.", "Le vétérinaire ou le DG importe un tableau Excel ou CSV avec « Importer un tableau », ou ajoute une ligne à la main.", "« Imprimer » donne la liste A4 filtrée, avec les abréviations."],
    tip: "Réimporter un tableau sous le même nom remplace ses anciennes lignes : pratique pour une nouvelle édition.",
  },
  "/stock/calculateur": {
    title: "Calculateur de dose",
    what: "Calcule la dose à administrer selon l'espèce et le poids.",
    steps: ["Choisissez l'espèce.", "Tapez le nom de la molécule ou du produit.", "Saisissez le poids : la dose et le volume s'affichent.", "« Créer l'ordonnance » reprend le calcul."],
  },
  "/finances/depenses": {
    title: "Dépenses",
    what: "Toutes les sorties d'argent, avec leurs preuves.",
    steps: ["« Nouvelle dépense » : libellé, montant, compte.", "« Prendre en photo » photographie la facture avec le téléphone.", "Collez le lien Drive si la facture est déjà en ligne.", "Rattachez-la à un projet si elle en fait partie."],
    tip: "Les dépenses sans preuve sont signalées en orange : ouvrez-les pour ajouter la photo.",
  },
  "/finances/projets": {
    title: "Projets",
    what: "Suivre ce qu'a coûté un projet (travaux, campagne, équipement).",
    steps: ["« Nouveau projet » : nom et enveloppe prévue.", "Rattachez les dépenses au projet.", "La carte montre ce qui est dépensé et ce qui reste."],
  },
  "/finances/encaissements": {
    title: "Encaissements",
    what: "L'argent reçu des clients.",
    steps: ["« Nouvel encaissement » : client, montant, moyen de paiement.", "Affectez-le aux factures qu'il règle."],
  },
  "/finances": {
    title: "Finances",
    what: "La situation de la caisse, des comptes et de la trésorerie.",
    steps: ["Les soldes des comptes sont en haut.", "Utilisez les sous-menus pour les encaissements, dépenses et créances."],
  },
  "/facturation": {
    title: "Factures",
    what: "Toutes les factures, leur statut et ce qui reste à payer.",
    steps: ["Filtrez par statut pour voir les impayés.", "Cliquez sur une facture pour l'imprimer ou l'encaisser."],
  },
  "/exploitations/": {
    title: "Exploitation",
    what: "Tout l'élevage : cheptel, prises en charge, visites et interventions.",
    steps: ["« Consultation / prise en charge » : un animal malade, une visite ou un traitement de routine, ou tout le cheptel.", "Choisissez l'espèce puis l'animal (n° de boucle), la bande ou tout le cheptel.", "Notez l'examen, le diagnostic, le traitement et les conseils ; choisissez quand reprendre des nouvelles.", "Cochez « Consigner dans le rapport de visite » pour l'ajouter au rapport du jour."],
  },
  "/exploitations": {
    title: "Exploitations et élevages",
    what: "Les fermes suivies, leurs bandes et leurs visites.",
    steps: ["Cliquez sur une exploitation pour voir ses animaux, interventions et rapports.", "« Nouvelle exploitation » pour en ajouter une."],
  },
  "/rapports/recettes": {
    title: "Recettes par famille",
    what: "Voir quel pan de l'activité rapporte le plus et lequel pousser.",
    steps: ["Choisissez la période (mois, année…).", "Le classement montre chaque famille avec sa part, son évolution et sa marge.", "Cliquez sur une famille pour le détail et l'évolution sur 6 mois.", "Lisez les « Pistes d'action » à droite."],
    tip: "Le DG range les actes et produits dans les familles avec « Organiser les familles ».",
  },
  "/exploitations/suivi": {
    title: "Suivi des prises en charge",
    what: "Les animaux et cheptels traités en élevage, et quand prendre des nouvelles.",
    steps: ["L'onglet « Nouvelles à prendre » liste les éleveurs à appeler aujourd'hui.", "Ouvrez une prise en charge : boutons Appeler et WhatsApp pour joindre l'éleveur.", "Notez ses nouvelles (amélioration, aggravation, morts) : le prochain rappel se programme seul.", "Si un animal révèle une maladie du troupeau : « Prendre en charge tout le cheptel »."],
  },
  "/prophylaxie": {
    title: "Prophylaxie",
    what: "Les programmes de vaccins, déparasitages et soins préventifs, pour les élevages comme pour les chiens et chats, avec la date de chaque action.",
    steps: ["« À faire » liste ce qui est en retard, aujourd'hui et cette semaine : touchez « Fait aujourd'hui » quand c'est fait.", "« Appliquer un programme » : choisissez un modèle, puis la bande, le cheptel, l'animal identifié ou l'animal de compagnie, et la date de départ (arrivée des poussins, naissance…). Les dates se calculent seules.", "Ouvrez un programme pour noter une action faite, la reporter (le reste du calendrier peut suivre), en ajouter une ou l'imprimer pour l'éleveur.", "« Modèles » : vos programmes types, à modifier, dupliquer ou créer. Un programme adapté sur le terrain peut devenir un nouveau modèle."],
    tip: "Une action notée faite rejoint l'historique de l'exploitation ou le carnet de vaccination de l'animal.",
  },
  "/equipe/taches": {
    title: "Tâches de l'équipe",
    what: "Confier du travail, le suivre et le vérifier.",
    steps: ["« Confier une tâche » : quoi, qui, pour quand. Choisissez « Un document » si c'est un document à produire.", "La personne reçoit une notification et la voit dans « Mes tâches ».", "Quand c'est fait, elle touche « C'est fait » et colle le lien Drive du document.", "Vous validez dans « À vérifier », ou demandez une reprise avec un mot."],
  },
  "/finances/caisses": {
    title: "Caisses de suivi",
    what: "Suivre l'argent d'une activité : campagne, ferme, partenaire, chirurgie…",
    steps: ["Le DG crée la caisse : nom, objectif, couleur.", "« Affecter » : cochez les prestations ou encaissements qui en font partie (filtre par famille et période).", "Ajoutez une « Autre entrée » pour un apport ou un don (suivi seulement).", "La carte montre le total de la période et la progression vers l'objectif."],
  },
  "/rapports/marges": {
    title: "Marges",
    what: "Ce que rapportent vraiment vos ventes après le prix d'achat.",
    steps: ["Choisissez la période.", "Lisez la marge par activité, puis par article."],
  },
  "/materiel": {
    title: "Matériel et équipements",
    what: "L'inventaire de ce qui est à la clinique, avec son prix d'achat.",
    steps: ["« Ajouter du matériel » : nom, quantité, prix, état.", "Imprimez l'inventaire avec « Imprimer / PDF »."],
  },
  "/administration/categories": {
    title: "Catégories",
    what: "Vos catégories de produits et de dépenses.",
    steps: ["Renommez une catégorie directement dans la case.", "Ajoutez-en une en bas de la liste.", "Pour en supprimer une qui contient des produits, choisissez où les déplacer.", "Cliquez « Enregistrer »."],
  },
  "/aide": {
    title: "Centre d'aide",
    what: "Les tutoriels vidéo pour apprendre à utiliser Cliva.",
    steps: ["Commencez par « Prise en main ».", "Cliquez sur un tutoriel pour le regarder.", "Cochez « Vu » quand c'est fait."],
  },
};

/** Aide de la page : correspondance exacte, sinon le préfixe le plus long. */
export function helpFor(path: string): PageHelp | undefined {
  if (H[path]) return H[path];
  let best: string | undefined;
  for (const k of Object.keys(H)) if (k !== "/" && (path.startsWith(`${k}/`) || (k.endsWith("/") && path.startsWith(k))) && (!best || k.length > best.length)) best = k;
  return best ? H[best] : undefined;
}
