/**
 * Tutoriels vidéo : scénarios prêts à tourner (écran du téléphone ou de l'ordinateur + voix),
 * à héberger sur YouTube (non répertorié) ou Google Drive puis à coller dans le Centre d'aide.
 */
import type { Tutorial } from "./types";

const T = (id: string, theme: string, title: string, minutes: number, routes: string[], audience: string, script: [string, string][]): Tutorial => ({
  id,
  theme,
  title,
  minutes,
  routes,
  audience,
  script: script.map(([show, say]) => ({ show, say })),
});

export const DEFAULT_TUTORIALS: Tutorial[] = [
  T("tuto-prise-en-main", "Démarrer", "Prise en main de Cliva", 3, ["/", "/aide"], "Tout le monde", [
    ["Écran de connexion", "Bienvenue sur Cliva. Pour entrer, choisissez votre profil et touchez « Se connecter »."],
    ["Tableau de bord", "Voici la vue d'ensemble : les rendez-vous du jour, la salle d'attente, et ce qui attend une action."],
    ["Menu de gauche", "À gauche, le menu. Les pastilles rouges indiquent ce qui vous attend. Sur téléphone, il s'ouvre avec le bouton en haut à gauche."],
    ["Bouton « Que voulez-vous faire ? »", "Ne cherchez pas dans les menus : touchez « Que voulez-vous faire ? » et choisissez la tâche en mots simples."],
    ["Bouton « ? Aide »", "Sur chaque page, le bouton Aide explique à quoi sert l'écran et comment faire, avec la vidéo qui va avec."],
    ["Bouton « Aa »", "Si le texte est trop petit, touchez « Aa » et choisissez Grand ou Très grand."],
  ]),
  T("tuto-rdv", "Accueil", "Prendre un rendez-vous", 2, ["/agenda", "/agenda/demandes"], "Accueil, assistants", [
    ["Agenda, vue semaine", "Pour prendre un rendez-vous, ouvrez l'agenda et touchez la case du jour et de l'heure voulus."],
    ["Formulaire du rendez-vous", "Choisissez le client, puis l'animal, le vétérinaire et le motif."],
    ["Bandeau orange « soumis à l'accord »", "Si le vétérinaire valide lui-même ses rendez-vous, un bandeau orange s'affiche : écrivez-lui un petit message et touchez « Envoyer la demande ». Dites au client que vous le rappelez pour confirmer."],
    ["Notification d'accord", "Dès que le vétérinaire répond, vous recevez une notification. Rappelez alors le client."],
  ]),
  T("tuto-valider-rdv", "Accueil", "Valider les demandes de rendez-vous (vétérinaire)", 2, ["/agenda/demandes"], "DG, vétérinaires", [
    ["Pastille rouge sur « Demandes de RDV »", "Quand l'équipe prend un rendez-vous pour vous, une pastille rouge apparaît dans le menu Agenda."],
    ["Carte de la demande", "Chaque demande montre le client, le motif, et votre journée en dessous. En rouge : ce qui chevauche."],
    ["Boutons Accepter / Autre horaire / Refuser", "Acceptez, proposez un autre horaire, ou refusez avec un motif. Le collaborateur est prévenu automatiquement."],
  ]),
  T("tuto-enregistrement-rapide", "Accueil", "Enregistrer vite un nouveau client et son animal", 2, ["/patients", "/clients"], "Accueil, assistants", [
    ["Page Patients", "Un nouveau client arrive avec son animal ? Allez dans Patients et touchez « Enregistrement rapide »."],
    ["Formulaire court", "Nom et téléphone du propriétaire, nom et espèce de l'animal. C'est tout : touchez « Enregistrer et ouvrir »."],
    ["Bandeau « Fiche à compléter »", "Plus tard, quand vous avez le temps, ce bandeau vous rappelle de compléter l'adresse, la race, la puce…"],
  ]),
  T("tuto-consultation", "Soins", "Faire une consultation et sa facture", 4, ["/consultations/nouvelle", "/consultations"], "Vétérinaires", [
    ["Bouton « Consultation »", "Depuis la fiche de l'animal ou le tableau de bord, touchez « Consultation »."],
    ["Examen et diagnostic", "Notez le motif, l'examen clinique, le diagnostic."],
    ["Actes et produits", "Ajoutez les actes réalisés et les produits utilisés : la facture se prépare toute seule."],
    ["Calculateur de dose", "Besoin d'une dose ? Le calculateur donne le volume selon le poids, et crée l'ordonnance."],
    ["Validation", "Validez : la consultation est enregistrée et la facture est prête à encaisser."],
  ]),
  T("tuto-domicile", "Soins", "Consultation à domicile", 2, ["/consultations/domicile"], "Vétérinaires", [
    ["Consultations à domicile", "Pour une urgence ou une visite chez le client, touchez « Nouvelle visite à domicile »."],
    ["Formulaire", "Urgence ou À la demande ; l'adresse se remplit depuis la fiche client. Collez le lien Google Maps envoyé par le client."],
    ["Sur la route", "Touchez « Départ » en partant, « Arrivée » sur place, puis « Démarrer la consultation » : les frais de déplacement sont déjà sur la facture."],
  ]),
  T("tuto-vente", "Pharmacie", "Vendre au comptoir", 3, ["/stock/vente"], "Accueil, vendeurs", [
    ["Vente pharmacie", "Pour vendre un produit, touchez « Vente pharmacie »."],
    ["Type de client", "Déjà client, Nouveau, ou De passage. Pour un client de passage, notez au moins son téléphone pour le relancer."],
    ["Panier", "Cherchez le produit, ajustez la quantité."],
    ["Paiement", "Choisissez espèces, Mobile Money ou carte, tapez la somme reçue, puis « Valider la vente ». La monnaie à rendre s'affiche."],
  ]),
  T("tuto-depense", "Argent", "Saisir une dépense avec la photo de la facture", 2, ["/finances/depenses", "/finances/projets"], "Accueil, comptable", [
    ["Dépenses", "Pour enregistrer une dépense, ouvrez Finances puis Dépenses, et touchez « Nouvelle dépense »."],
    ["Montant et compte", "Libellé, montant, compte qui paie."],
    ["Prendre en photo", "Touchez « Prendre en photo » : l'appareil photo s'ouvre, photographiez la facture."],
    ["Lien Drive et projet", "Si la facture est sur Drive, collez le lien. Si la dépense fait partie d'un projet, choisissez-le."],
    ["Dépenses sans preuve", "Le bandeau orange liste les dépenses sans preuve : ouvrez-les pour ajouter la photo plus tard."],
  ]),
  T("tuto-caisse", "Argent", "Encaisser et faire la caisse du jour", 3, ["/finances/encaissements", "/finances", "/"], "Accueil, comptable", [
    ["Encaissements", "Quand un client paie une facture, touchez « Nouvel encaissement »."],
    ["Affectation", "Choisissez le client et le moyen de paiement, puis la ou les factures réglées."],
    ["Tableau de bord Gestion", "Le soir, l'onglet Gestion montre les recettes du jour par moyen de paiement : comparez avec la caisse."],
  ]),
  T("tuto-recettes", "Pilotage", "Voir ce qui rapporte le plus", 3, ["/rapports/recettes", "/rapports/marges"], "DG", [
    ["Recettes par famille", "Dans Rapports, ouvrez « Recettes par famille »."],
    ["Période", "Choisissez le mois ou l'année, et la clientèle : compagnie ou rente."],
    ["Classement", "Chaque famille montre son montant, sa part, son évolution et sa marge. Touchez-la pour voir le détail sur 6 mois."],
    ["Pistes d'action", "À droite, les pistes : ce qui est à pousser, à surveiller, à corriger."],
    ["Organiser les familles", "Le DG range les actes et produits dans ses propres familles avec « Organiser les familles »."],
  ]),
  T("tuto-prise-en-charge", "Rural", "Consultation et prise en charge en élevage", 4, ["/exploitations", "/exploitations/suivi", "/missions"], "Vétérinaires, techniciens", [
    ["Fiche de l'exploitation", "Sur la fiche de l'élevage, touchez « Consultation / prise en charge »."],
    ["Pourquoi ?", "Choisissez : un animal ne va pas, visite de routine, traitement de routine, ou pathologie sur tout le cheptel."],
    ["Pour quels animaux ?", "Choisissez l'espèce, puis l'animal par son numéro de boucle, une bande, ou tout le cheptel. Un nouvel animal s'identifie sur place."],
    ["Examen, traitement, conseils", "Notez température, fréquences, constatations, diagnostic, puis les produits avec dose, voie et durée, et les conseils à l'éleveur."],
    ["Suivi", "Choisissez quand reprendre des nouvelles. Ce jour-là, l'éleveur apparaît dans « Suivi des prises en charge » avec une pastille rouge."],
    ["Étendre au cheptel", "Si le diagnostic d'un animal concerne tout le troupeau, ouvrez la prise en charge et touchez « Prendre en charge tout le cheptel »."],
  ]),
  T("tuto-prophylaxie", "Soins", "Suivre une prophylaxie (élevage, chien, chat)", 4, ["/prophylaxie", "/exploitations", "/patients"], "Vétérinaires, assistants", [
    ["Les modèles", "Dans Prophylaxie, l'onglet « Modèles » contient les programmes types : poulets de chair, pondeuses, bovins, petits ruminants, porcelets, chiot, chaton. Modifiez-les selon votre pratique."],
    ["Appliquer", "Touchez « Appliquer un programme », choisissez le modèle et pour qui : une bande, tout le cheptel, un animal identifié ou un animal de compagnie."],
    ["La date de départ", "Indiquez le jour de départ (arrivée des poussins, naissance…). Cliva calcule la date de chaque action ; vous pouvez en changer avant de valider."],
    ["Au quotidien", "L'onglet « À faire » et la pastille du menu montrent les actions du jour et en retard. « Fait aujourd'hui » les enregistre dans l'historique."],
    ["Reporter", "Ouvrez le programme, « Modifier / reporter » une action, et cochez « Décaler aussi les actions suivantes »."],
    ["Imprimer et réutiliser", "« Imprimer » donne la fiche A4 à remettre à l'éleveur. « Enregistrer comme modèle » garde vos adaptations pour le prochain cas."],
  ]),
  T("tuto-taches", "Équipe", "Confier une tâche ou un document", 2, ["/equipe/taches"], "DG, responsables", [
    ["Tâches de l'équipe", "Ouvrez Équipe puis Tâches de l'équipe, et touchez « Confier une tâche »."],
    ["Quoi, qui, quand", "Écrivez la tâche, choisissez la personne et la date. Pour un document, choisissez « Un document à produire »."],
    ["C'est fait", "La personne touche « C'est fait » et colle le lien Drive du document."],
    ["Vérifier", "Dans « À vérifier », validez ou demandez une reprise avec un commentaire."],
  ]),
  T("tuto-categories", "Pilotage", "Gérer les catégories de produits", 2, ["/administration/categories", "/stock/catalogue"], "DG", [
    ["Catalogue > Gérer les catégories", "Dans le catalogue, touchez « Gérer les catégories »."],
    ["Renommer, ajouter, ranger", "Renommez dans la case, ajoutez en bas, rangez avec les flèches."],
    ["Supprimer ou fusionner", "Pour supprimer une catégorie qui contient des produits, choisissez la catégorie qui les reçoit, puis Enregistrer."],
  ]),
  T("tuto-elevage", "Rural", "Suivre un élevage", 3, ["/exploitations", "/missions"], "Vétérinaires, techniciens", [
    ["Exploitations", "Ouvrez Exploitations et élevages, puis la ferme."],
    ["Bandes et effectifs", "Chaque bande montre son espèce, son effectif et son historique."],
    ["Intervention et rapport", "Ajoutez une intervention (vaccination, analyse, autopsie) et imprimez le rapport pour l'éleveur."],
  ]),
];
