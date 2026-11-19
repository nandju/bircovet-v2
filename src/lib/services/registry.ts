/**
 * Registre central des opérations exposables par la future API (périmètre MVP).
 * Chaque clé stable associe un service à son module et à l'action de permission
 * correspondante (vérifiée côté serveur via canWith + db.settings.permissions).
 *
 * ⚠️ Les contrôles fins (requireRole, requireOnline, délégations) restent DANS
 * les services : le couple module/action du registre est une porte d'entrée
 * supplémentaire, pas un remplacement.
 *
 * JAMAIS dans ce registre (décision volontaire) :
 *  - platformService (console éditeur) sauf trackCampaign ;
 *  - simulateRemoteConflict, synchronize, resolveConflict, clearSynced (outils
 *    de la démo hors ligne — remplacés par le vrai offline en production) ;
 *  - restoreBackup (outil de démonstration locale).
 */
import type { ModuleId, PermAction } from "../permissions";
import {
  createUser, updateUser, setUserActive, setUserRole, createEstablishment, updateEstablishment,
  updateSettings, setRolePermission, resetRolePermissions, setRoleLabel, saveCategories, saveRevenueFamilies,
  saveAnnouncement, moveAnnouncement, deleteAnnouncement, trackAnnouncement, recordLicencePayment,
} from "./adminService";
import { runAlertScan, saveAlertRules } from "./alertsService";
import {
  createAppointment, decideAppointmentRequest, updateAppointment, cancelAppointment, confirmAppointment,
  setQueueStatus, markHomeVisit, addUnavailability, removeUnavailability, saveApptApproval,
} from "./appointmentsService";
import { saveCashBox, assignToCashBox, addCashBoxEntry, removeCashBoxEntry } from "./cashBoxService";
import { openCareCase, logCareFollowUp, closeCareCase, registerFarmAnimal } from "./careService";
import { createClient, updateClient, setClientArchived, addClientNote, mergeClients } from "./clientsService";
import {
  createConsultation, updateConsultation, submitConsultation, validateConsultation, returnToDraft,
  setActs, markPrepaid, requestPaymentException, decidePaymentException, recordEuthanasia,
} from "./consultationsService";
import type { Service } from "./core";
import { counterSale } from "./counterSaleService";
import { importDrugIndex, saveDrugIndexEntry, deleteDrugIndexEntry, removeDrugIndexSource } from "./drugIndexService";
import {
  createFarm, updateFarm, addBuilding, addFarmLot, addHeadcount, addAnimalMovement, addFarmVisit,
  addFarmIntervention, setFarmScale, setLotCount, saveFarmScaleSettings,
} from "./farmsService";
import {
  createExpense, decideExpense, createAccountTransfer, closeCash, requestCredit, decideCredit,
  createOpeningReceivable, setOpeningBalance, createAccount,
} from "./financesService";
import {
  createProduct, updateProduct, setLotStatus, proposeCorrection, decideCorrection, transferStock,
  receiveTransfer, startInventory, setInventoryCount, proposeInventory, validateInventory,
} from "./inventoryService";
import {
  createQuote, updateQuote, setQuoteStatus, convertQuote, createInvoice, updateInvoiceDraft, submitInvoice,
  validateInvoice, cancelInvoice, createCreditNote, createGroupedInvoice, createProforma, convertProforma,
  setFneStatus, setFneNumber,
} from "./invoicesService";
import {
  createPatient, updatePatient, addVital, addVaccination, addPatientNote, transferOwnership, declareDeath,
  setPatientAlerts, addPatientPhoto, removePatientPhoto, addPatientExam,
} from "./patientsService";
import { markNotificationsRead } from "./notificationsService";
import { recordPayment, allocatePayment } from "./paymentsService";
import { logCalculation, saveDraftMolecule, setMoleculeStatus } from "./pharmaService";
import { trackCampaign } from "./platformService";
import {
  createPrescription, createPrescriptionOrder, validatePrescriptionOrder, submitPrescription,
  validatePrescription, cancelPrescription, deliverPrescription,
} from "./prescriptionsService";
import {
  saveProphylaxisProgram, setProgramActive, assignProphylaxis, markProphyStepDone, undoProphyStep,
  editProphyStep, addProphyStep, cancelProphyStep, closeProphyPlan, planToProgram,
} from "./prophylaxisService";
import { quickRegister } from "./quickRegisterService";
import {
  createSupplier, updateSupplier, createPurchaseOrder, updatePurchaseOrder, setPOStatus,
  saveOrderReview, createReception, validateReception, checkReceptionLine, rejectReception,
} from "./suppliersService";
import { createTreatment, logDose, logDay, addEvolution, stopTreatment } from "./treatmentsService";

/** N'importe quel service (contravariance : accepte tout Service<I, T>). */
export type AnyService = Service<never, unknown>;

export interface OperationDef {
  fn: AnyService;
  module: ModuleId;
  action: PermAction;
}

const op = (fn: AnyService, module: ModuleId, action: PermAction): OperationDef => ({ fn, module, action });

export const OPERATIONS: Record<string, OperationDef> = {
  /* ---- Accueil & agenda ---- */
  "agenda.creerRdv": op(createAppointment, "agenda", "create"),
  "agenda.deciderDemande": op(decideAppointmentRequest, "agenda", "update"),
  "agenda.modifierRdv": op(updateAppointment, "agenda", "update"),
  "agenda.annulerRdv": op(cancelAppointment, "agenda", "update"),
  "agenda.confirmerRdv": op(confirmAppointment, "agenda", "update"),
  "agenda.fileAttente": op(setQueueStatus, "agenda", "update"),
  "agenda.visiteDomicile": op(markHomeVisit, "agenda", "update"),
  "agenda.indisponibilite.ajouter": op(addUnavailability, "agenda", "update"),
  "agenda.indisponibilite.retirer": op(removeUnavailability, "agenda", "update"),
  "accueil.enregistrementRapide": op(quickRegister, "clients", "create"),
  "agenda.validationRdv": op(saveApptApproval, "admin", "admin"),
  "notifications.lire": op(markNotificationsRead, "dashboard", "read"),

  /* ---- Clients ---- */
  "clients.creer": op(createClient, "clients", "create"),
  "clients.modifier": op(updateClient, "clients", "update"),
  "clients.archiver": op(setClientArchived, "clients", "update"),
  "clients.note": op(addClientNote, "clients", "update"),
  "clients.fusionner": op(mergeClients, "clients", "update"),

  /* ---- Patients & fiches ---- */
  "patients.creer": op(createPatient, "patients", "create"),
  "patients.modifier": op(updatePatient, "patients", "update"),
  "patients.constantes": op(addVital, "patients", "update"),
  "patients.vaccination": op(addVaccination, "patients", "update"),
  "patients.note": op(addPatientNote, "patients", "update"),
  "patients.cession": op(transferOwnership, "patients", "update"),
  "patients.deces": op(declareDeath, "patients", "validate"),
  "patients.alertes": op(setPatientAlerts, "patients", "update"),
  "patients.photo.ajouter": op(addPatientPhoto, "patients", "update"),
  "patients.photo.retirer": op(removePatientPhoto, "patients", "update"),
  "patients.examen": op(addPatientExam, "patients", "update"),

  /* ---- Consultations ---- */
  "consultations.creer": op(createConsultation, "consultations", "create"),
  "consultations.modifier": op(updateConsultation, "consultations", "update"),
  "consultations.soumettre": op(submitConsultation, "consultations", "update"),
  "consultations.valider": op(validateConsultation, "consultations", "validate"),
  "consultations.brouillon": op(returnToDraft, "consultations", "validate"),
  "consultations.actes": op(setActs, "consultations", "update"),
  "consultations.prepayee": op(markPrepaid, "consultations", "update"),
  "consultations.exception.demander": op(requestPaymentException, "consultations", "update"),
  "consultations.exception.decider": op(decidePaymentException, "consultations", "validate"),
  "consultations.euthanasie": op(recordEuthanasia, "consultations", "validate"),

  /* ---- Ordonnances & traitements ---- */
  "ordonnances.creer": op(createPrescriptionOrder, "prescriptions", "create"),
  "ordonnances.valider": op(validatePrescriptionOrder, "prescriptions", "validate"),
  "prescriptions.creer": op(createPrescription, "prescriptions", "create"),
  "prescriptions.soumettre": op(submitPrescription, "prescriptions", "update"),
  "prescriptions.valider": op(validatePrescription, "prescriptions", "validate"),
  "prescriptions.annuler": op(cancelPrescription, "prescriptions", "validate"),
  "prescriptions.delivrer": op(deliverPrescription, "prescriptions", "update"),
  "traitements.creer": op(createTreatment, "prescriptions", "create"),
  "traitements.dose": op(logDose, "prescriptions", "update"),
  "traitements.jour": op(logDay, "prescriptions", "update"),
  "traitements.evolution": op(addEvolution, "prescriptions", "update"),
  "traitements.arreter": op(stopTreatment, "prescriptions", "update"),

  /* ---- Prévention / prophylaxie (module patients — à confirmer avec les écrans) ---- */
  "prophylaxie.programme.enregistrer": op(saveProphylaxisProgram, "patients", "update"),
  "prophylaxie.programme.actif": op(setProgramActive, "patients", "update"),
  "prophylaxie.assigner": op(assignProphylaxis, "patients", "update"),
  "prophylaxie.etape.faite": op(markProphyStepDone, "patients", "update"),
  "prophylaxie.etape.annulerFait": op(undoProphyStep, "patients", "update"),
  "prophylaxie.etape.modifier": op(editProphyStep, "patients", "update"),
  "prophylaxie.etape.ajouter": op(addProphyStep, "patients", "update"),
  "prophylaxie.etape.annuler": op(cancelProphyStep, "patients", "update"),
  "prophylaxie.plan.cloturer": op(closeProphyPlan, "patients", "update"),
  "prophylaxie.planVersProgramme": op(planToProgram, "patients", "update"),

  /* ---- Élevages ---- */
  "exploitations.creer": op(createFarm, "exploitations", "create"),
  "exploitations.modifier": op(updateFarm, "exploitations", "update"),
  "exploitations.batiment": op(addBuilding, "exploitations", "update"),
  "exploitations.lot": op(addFarmLot, "exploitations", "update"),
  "exploitations.effectif": op(addHeadcount, "exploitations", "update"),
  "exploitations.mouvement": op(addAnimalMovement, "exploitations", "update"),
  "exploitations.visite": op(addFarmVisit, "exploitations", "update"),
  "exploitations.intervention": op(addFarmIntervention, "exploitations", "update"),
  "exploitations.taille": op(setFarmScale, "exploitations", "update"),
  "exploitations.lot.effectif": op(setLotCount, "exploitations", "update"),
  "exploitations.animal": op(registerFarmAnimal, "exploitations", "update"),
  "exploitations.reglagesTaille": op(saveFarmScaleSettings, "exploitations", "update"),
  "priseEnCharge.ouvrir": op(openCareCase, "exploitations", "create"),
  "priseEnCharge.suivre": op(logCareFollowUp, "exploitations", "update"),
  "priseEnCharge.cloturer": op(closeCareCase, "exploitations", "update"),

  /* ---- Pharmacie & stock ---- */
  "stock.produit.creer": op(createProduct, "stock", "create"),
  "stock.produit.modifier": op(updateProduct, "stock", "update"),
  "stock.lot.statut": op(setLotStatus, "stock", "update"),
  "stock.correction.proposer": op(proposeCorrection, "stock", "update"),
  "stock.correction.decider": op(decideCorrection, "stock", "validate"),
  "stock.transfert.envoyer": op(transferStock, "stock", "update"),
  "stock.transfert.recevoir": op(receiveTransfer, "stock", "update"),
  "stock.inventaire.demarrer": op(startInventory, "stock", "update"),
  "stock.inventaire.compter": op(setInventoryCount, "stock", "update"),
  "stock.inventaire.proposer": op(proposeInventory, "stock", "update"),
  "stock.inventaire.valider": op(validateInventory, "stock", "validate"),
  "stock.venteComptoir": op(counterSale, "stock", "create"),
  "index.importer": op(importDrugIndex, "stock", "update"),
  "index.entree": op(saveDrugIndexEntry, "stock", "update"),
  "index.supprimerEntree": op(deleteDrugIndexEntry, "stock", "update"),
  "index.supprimerSource": op(removeDrugIndexSource, "stock", "admin"),
  "index.molecule.brouillon": op(saveDraftMolecule, "stock", "update"),
  "index.molecule.statut": op(setMoleculeStatus, "stock", "update"),
  "calculateur.journal": op(logCalculation, "stock", "create"),
  "alertes.scanner": op(runAlertScan, "stock", "read"),
  "alertes.regles": op(saveAlertRules, "stock", "update"),

  /* ---- Achats : fournisseurs, commandes, réceptions (entrées de stock) ---- */
  "achats.fournisseur.creer": op(createSupplier, "achats", "create"),
  "achats.fournisseur.modifier": op(updateSupplier, "achats", "update"),
  "achats.commande.creer": op(createPurchaseOrder, "achats", "create"),
  "achats.commande.modifier": op(updatePurchaseOrder, "achats", "update"),
  "achats.commande.statut": op(setPOStatus, "achats", "validate"),
  "achats.commande.evaluation": op(saveOrderReview, "achats", "update"),
  "achats.reception.creer": op(createReception, "achats", "create"),
  "achats.reception.valider": op(validateReception, "achats", "validate"),
  "achats.reception.ligne": op(checkReceptionLine, "achats", "update"),
  "achats.reception.rejeter": op(rejectReception, "achats", "validate"),

  /* ---- Facturation & caisse ---- */
  "devis.creer": op(createQuote, "facturation", "create"),
  "devis.modifier": op(updateQuote, "facturation", "update"),
  "devis.statut": op(setQuoteStatus, "facturation", "update"),
  "devis.convertir": op(convertQuote, "facturation", "create"),
  "factures.creer": op(createInvoice, "facturation", "create"),
  "factures.modifierBrouillon": op(updateInvoiceDraft, "facturation", "update"),
  "factures.soumettre": op(submitInvoice, "facturation", "update"),
  "factures.valider": op(validateInvoice, "facturation", "validate"),
  "factures.annuler": op(cancelInvoice, "facturation", "validate"),
  "factures.avoir": op(createCreditNote, "facturation", "validate"),
  "factures.groupee": op(createGroupedInvoice, "facturation", "create"),
  "factures.proforma": op(createProforma, "facturation", "create"),
  "factures.convertirProforma": op(convertProforma, "facturation", "create"),
  "factures.fne.statut": op(setFneStatus, "facturation", "update"),
  "factures.fne.numero": op(setFneNumber, "facturation", "update"),
  "paiements.encaisser": op(recordPayment, "finances", "create"),
  "paiements.affecter": op(allocatePayment, "finances", "update"),
  "depenses.creer": op(createExpense, "finances", "create"),
  "depenses.decider": op(decideExpense, "finances", "validate"),
  "finances.transfert": op(createAccountTransfer, "finances", "validate"),
  "finances.clotureCaisse": op(closeCash, "finances", "update"),
  "finances.credit.demander": op(requestCredit, "finances", "update"),
  "finances.credit.decider": op(decideCredit, "finances", "validate"),
  "finances.creanceOuverture": op(createOpeningReceivable, "finances", "validate"),
  "finances.soldeOuverture": op(setOpeningBalance, "finances", "validate"),
  "finances.compte.creer": op(createAccount, "finances", "admin"),
  "caisses.enregistrer": op(saveCashBox, "finances", "update"),
  "caisses.affecter": op(assignToCashBox, "finances", "update"),
  "caisses.entree": op(addCashBoxEntry, "finances", "update"),
  "caisses.retirerEntree": op(removeCashBoxEntry, "finances", "update"),

  /* ---- Équipe & réglages ---- */
  "admin.utilisateur.creer": op(createUser, "admin", "admin"),
  "admin.utilisateur.modifier": op(updateUser, "admin", "admin"),
  "admin.utilisateur.actif": op(setUserActive, "admin", "admin"),
  "admin.utilisateur.role": op(setUserRole, "admin", "admin"),
  "admin.etablissement.creer": op(createEstablishment, "admin", "admin"),
  "admin.etablissement.modifier": op(updateEstablishment, "admin", "admin"),
  "admin.parametres": op(updateSettings, "admin", "admin"),
  "admin.permissions.modifier": op(setRolePermission, "admin", "admin"),
  "admin.permissions.reinitialiser": op(resetRolePermissions, "admin", "admin"),
  "admin.permissions.libelle": op(setRoleLabel, "admin", "admin"),
  "admin.categories": op(saveCategories, "admin", "admin"),
  "admin.famillesRecettes": op(saveRevenueFamilies, "admin", "admin"),
  "admin.licence.paiement": op(recordLicencePayment, "admin", "admin"),
  "annonces.enregistrer": op(saveAnnouncement, "admin", "admin"),
  "annonces.deplacer": op(moveAnnouncement, "admin", "admin"),
  "annonces.supprimer": op(deleteAnnouncement, "admin", "admin"),
  "annonces.suivi": op(trackAnnouncement, "dashboard", "read"),

  /* ---- Annonces (seule opération platformService autorisée) ---- */
  "annonces.comptage": op(trackCampaign, "dashboard", "read"),
};

/** Clé d'opération valide ? (pour la future API : rejeter toute clé inconnue.) */
export const isOperationKey = (k: string): boolean => Object.prototype.hasOwnProperty.call(OPERATIONS, k);
