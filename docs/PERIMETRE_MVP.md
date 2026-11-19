# Périmètre MVP — classement des 135 services hors registre (audit du 17/11/2026)

> Table de décision validée : chaque service appelé par un écran et absent du
> registre `OPERATIONS` est soit **ajouté au registre** (19 services + 1 service
> extrait, `markNotificationsRead`), soit **hors MVP** (116 services — en mode
> API, `run()` les refuse avec le toast « Cette fonction n'est pas encore
> disponible dans la version de test. »).
>
> Réactivation d'un module : ajouter le module à `MVP_MODULES` et ses services
> à `OPERATIONS` (`src/lib/services/registry.ts`), puis retirer ses clés de
> `MVP_HIDDEN_NAV_KEYS` (`src/lib/mvp.ts`).

## A. Ajoutés au registre (20)

| Service | Fichier | Décision | Raison |
|---|---|---|---|
| `createSupplier` | `suppliersService.ts` | ajouté (`achats.fournisseur.creer`) | Fournisseurs — réapprovisionnement du stock |
| `updateSupplier` | `suppliersService.ts` | ajouté (`achats.fournisseur.modifier`) | idem |
| `createPurchaseOrder` | `suppliersService.ts` | ajouté (`achats.commande.creer`) | Commandes — entrées de stock |
| `updatePurchaseOrder` | `suppliersService.ts` | ajouté (`achats.commande.modifier`) | idem |
| `setPOStatus` | `suppliersService.ts` | ajouté (`achats.commande.statut`) | Décision de statut (envoi/annulation) |
| `saveOrderReview` | `suppliersService.ts` | ajouté (`achats.commande.evaluation`) | Évaluation de la commande |
| `createReception` | `suppliersService.ts` | ajouté (`achats.reception.creer`) | Réception de commande = entrée de stock |
| `validateReception` | `suppliersService.ts` | ajouté (`achats.reception.valider`) | Validation → mouvements de stock |
| `checkReceptionLine` | `suppliersService.ts` | ajouté (`achats.reception.ligne`) | Contrôle ligne de réception |
| `rejectReception` | `suppliersService.ts` | ajouté (`achats.reception.rejeter`) | Décision de refus |
| `saveApptApproval` | `appointmentsService.ts` | ajouté (`agenda.validationRdv`) | Réglage DG « validation des RDV » |
| `saveDraftMolecule` | `pharmaService.ts` | ajouté (`index.molecule.brouillon`) | Index thérapeutique (MVP) |
| `setMoleculeStatus` | `pharmaService.ts` | ajouté (`index.molecule.statut`) | idem |
| `saveAnnouncement` | `adminService.ts` | ajouté (`annonces.enregistrer`) | Annonces du tableau de bord |
| `moveAnnouncement` | `adminService.ts` | ajouté (`annonces.deplacer`) | Ordre des annonces |
| `deleteAnnouncement` | `adminService.ts` | ajouté (`annonces.supprimer`) | Suppression d'annonce |
| `trackAnnouncement` | `adminService.ts` | ajouté (`annonces.suivi`) | Comptage vues/clics — tout rôle |
| `recordLicencePayment` | `adminService.ts` | ajouté (`admin.licence.paiement`) | Suivi de licence (réglages DG) |
| `saveFarmScaleSettings` | `farmsService.ts` | ajouté (`exploitations.reglagesTaille`) | Réglage de l'élevage |
| `markNotificationsRead` | `notificationsService.ts` *(créé)* | ajouté (`notifications.lire`) | « Lu » synchronisé serveur (rapport #6) |

## B. Hors MVP (116) — regroupés par fichier

| Services | Fichier | Décision | Raison |
|---|---|---|---|
| `admitPatient`, `dischargePatient`, `closeStay`, `invoiceStay`, `recordCareAct`, `addObservation`, `addTransmission`, `addCarePlanItem`, `toggleCarePlan`, `setConsent`, `completeFollowUp` | `hospitalizationsService.ts` | hors MVP | Hospitalisation hors périmètre (AUDIT §3.5) |
| `createMission`, `updateMission`, `setMissionStatus`, `recordArrival`, `recordMissionUsage`, `saveMissionReport`, `addMissionAction`, `toggleMissionAction`, `addMissionPhoto`, `updateMissionPhoto`, `transferToMission`, `reconcileMission`, `invoiceMission` | `missionsService.ts` | hors MVP | Missions terrain hors périmètre |
| `createTraining`, `createSession`, `updateSession`, `registerParticipant`, `removeParticipant`, `toggleAttendance`, `invoiceSessionPayer`, `signalCapacityAttempt` | `trainingsService.ts` | hors MVP | Formations hors périmètre |
| `createMeeting`, `updateMeetingReport`, `validateMeetingReport`, `addMeetingAction`, `toggleMeetingAction`, `addStaffPost`, `commentStaffPost`, `togglePinPost` | `teamService.ts` | hors MVP | Réunions / fil d'équipe hors périmètre |
| `requestLeave`, `decideLeave`, `cancelLeave`, `saveEvaluation`, `saveObjective`, `reviewObjective` | `staffService.ts` | hors MVP | RH (congés, évaluations) — « Équipe » MVP = utilisateurs/rôles seulement |
| `assignTeamTask`, `completeTeamTask`, `reviewTeamTask` | `teamTasksService.ts` | hors MVP | Tâches d'équipe hors périmètre |
| `startFollowUp`, `stopPlan`, `completeTouch`, `skipTouch`, `postponeTouch`, `recordContact`, `createProspect`, `updateProspect`, `moveProspect`, `convertProspect`, `logProspectContact`, `saveTemplate`, `deleteTemplate`, `updateFollowUpSettings` | `followUpService.ts` | hors MVP | Relation client étendue hors périmètre |
| `createTask`, `updateTask`, `setTaskStatus`, `postponeTask`, `logInteraction`, `logSimulatedMessage` | `tasksService.ts` | hors MVP | CRM / rappels étendus hors périmètre |
| `saveBudget`, `submitBudget`, `decideBudget`, `setPOBudgetLine` | `budgetsService.ts` | hors MVP | Budgets hors périmètre |
| `saveProject`, `setExpenseProject`, `addExpenseProof`, `removeExpenseProof` | `projectsService.ts` | hors MVP | Projets hors périmètre |
| `createBill`, `payBill`, `setPayAsSold` | `payablesService.ts` | hors MVP | Dettes fournisseurs (arbitrage validé : hors) |
| `createConsignment`, `setConsignmentStatus` | `consignmentsService.ts` | hors MVP | Consignations hors périmètre |
| `saveEquipment`, `deleteEquipment` | `equipmentService.ts` | hors MVP | Matériel hors périmètre |
| `addDocument`, `newDocumentVersion`, `setDocumentArchived` | `documentsService.ts` | hors MVP | Documents hors périmètre |
| `saveProtocol`, `setProtocolStatus`, `addExternalLink`, `removeExternalLink` | `protocolsService.ts` | hors MVP | Protocoles hors périmètre |
| `saveAdminFile`, `setAdminFileStatus`, `setDirectoryLink`, `toggleObligation` | `adminFilesService.ts` | hors MVP | Dossiers administratifs hors périmètre |
| `saveClinic`, `setClinicStatus`, `saveOffer`, `saveCampaign`, `deleteCampaign`, `recordPlatformPayment` | `platformService.ts` | hors MVP | Console plateforme — exclusion déjà décidée (`trackCampaign` reste seul autorisé) |
| `askAssistant`, `setDraftStatus`, `deleteConversation` | `aiService.ts` | hors MVP | Assistant IA hors périmètre du brief |
| `requestApproval`, `decideApproval`, `answerApproval` | `approvalsService.ts` | hors MVP | Circuit d'approbation générique hors périmètre |
| `synchronize`, `simulateRemoteConflict`, `resolveConflict`, `clearSynced` | `syncService.ts` | hors MVP | Outils de simulation offline démo — exclusion explicite |
| `restoreBackup` | `adminService.ts` | hors MVP | Restauration de sauvegarde démo — exclusion explicite |
| `sendTestNotification` | `alertsService.ts` | hors MVP | Notification de test, pas métier |
| `simulateReminder` | `appointmentsService.ts` | hors MVP | « Simuler un rappel » — pas métier |
| `markTutorialSeen`, `setTutorialVideo` | `tutorialsService.ts` | hors MVP | Tutoriels — état local de consultation seulement |

**Compteurs** : 135 services hors registre → 19 ajoutés + 1 service extrait (`markNotificationsRead`, créé) → **154 opérations** dans `OPERATIONS` ; 116 services classés hors MVP.

## Vérification couverture fonctionnelle (compléments)

Toutes les fonctions MVP listées sont enregistrées — aucun ajout supplémentaire :

- **Accueil** : `accueil.enregistrementRapide` (client + animal), `clients.modifier`/`clients.archiver`, `patients.modifier`/`patients.deces` (le patient n'a pas de statut « archive » : sa fermeture de fiche = déclaration de décès), `clients.note`/`patients.note`, `agenda.fileAttente`, `agenda.annulerRdv`/`agenda.modifierRdv` (report).
- **Consultation** : `consultations.creer`/`modifier` (constantes incluses dans le patch)/`soumettre`/`valider`/`actes`, `consultations.euthanasie`, `patients.deces`.
- **Prévention** : `prophylaxie.programme.enregistrer` (création/modification de modèles), `programme.actif`, `assigner` (animal/bande/cheptel), `etape.faite`, `etape.modifier` (report), `etape.*`.
- **Élevages** : `exploitations.creer`/`modifier`/`batiment`/`lot`/`effectif`/`mouvement`/`animal` (animaux identifiés), `priseEnCharge.ouvrir`/`suivre` (suivi des nouvelles)/`cloturer`, `exploitations.visite` (rapport de visite).
- **Pharmacie** : `stock.produit.creer`/`modifier`, `admin.categories`, `ordonnances.creer` (ordonnance après vente via `sale.invoiceId`), `prescriptions.delivrer`, `alertes.scanner`/`alertes.regles`, `index.importer`/`entree`/`supprimerEntree`/`supprimerSource`/`molecule.*`.
- **Facturation et caisse** : `devis.*` + `devis.convertir`, `factures.proforma`/`convertirProforma`, `factures.modifierBrouillon`, `factures.avoir`, `finances.clotureCaisse`.
- **Réglages** : `admin.utilisateur.*`, `admin.permissions.*`, `admin.parametres` (`Settings.watermark` = filigrane).
