/**
 * Tests des règles métier de la simulation (services purs, sans navigateur).
 * Lancer : npm run test:rules
 */
import { accountBalance, docTotal, invoiceBalance, lineTotal, productStock } from "../src/lib/calc";
import { isoLocal } from "../src/lib/format";
import { createSeed } from "../src/lib/seed";
import { createClient, findDuplicates, mergeClients } from "../src/lib/services/clientsService";
import { createPatient, transferOwnership, declareDeath, addPatientNote } from "../src/lib/services/patientsService";
import { createAppointment, findConflicts, setQueueStatus } from "../src/lib/services/appointmentsService";
import { createConsultation, submitConsultation, validateConsultation, recordEuthanasia, updateConsultation } from "../src/lib/services/consultationsService";
import { createPrescription, deliverPrescription, validatePrescription, remaining } from "../src/lib/services/prescriptionsService";
import { checkReceptionLine, createReception, validateReception, setPOStatus } from "../src/lib/services/suppliersService";
import { receiveTransfer, transferStock } from "../src/lib/services/inventoryService";
import { completeTouch } from "../src/lib/services/followUpService";
import { allMolecules } from "../src/lib/pharma/state";
import { counterSale } from "../src/lib/services/counterSaleService";
import { convertQuote, validateInvoice, createCreditNote, createGroupedInvoice, updateInvoiceDraft } from "../src/lib/services/invoicesService";
import { recordPayment } from "../src/lib/services/paymentsService";
import { requestCredit, decideCredit, createAccountTransfer } from "../src/lib/services/financesService";
import { admitPatient, recordCareAct, dischargePatient, invoiceStay } from "../src/lib/services/hospitalizationsService";
import { createMission, setMissionStatus, transferToMission, recordMissionUsage, reconcileMission } from "../src/lib/services/missionsService";
import { createSession, registerParticipant } from "../src/lib/services/trainingsService";
import { synchronize } from "../src/lib/services/syncService";
import { setUserActive } from "../src/lib/services/adminService";
import { askAssistant } from "../src/lib/services/aiService";
import { refreshDerived } from "../src/lib/services/core";
import { createTreatment, logDay, logDose } from "../src/lib/services/treatmentsService";
import { courseStats } from "../src/lib/treatments";
import { decideLeave, requestLeave } from "../src/lib/services/staffService";
import { leaveBalance, workingDays } from "../src/lib/staff";
import { createFarm } from "../src/lib/services/farmsService";
import { farmHerd, farmScale } from "../src/lib/farmProfile";
import { worldDaysBetween } from "../src/lib/worldDays";
import { runAlertScan, saveAlertRules } from "../src/lib/services/alertsService";
import { decideApproval, requestApproval } from "../src/lib/services/approvalsService";
import { saveFarmScaleSettings, setFarmScale, updateFarm } from "../src/lib/services/farmsService";
import { addExternalLink, saveProtocol, setProtocolStatus } from "../src/lib/services/protocolsService";
import { rulesOf } from "../src/lib/alerts";
import { visibleTo } from "../src/lib/notifications";
import { scaleSettings } from "../src/lib/farmProfile";
import { receiptsOn, stockOut } from "../src/lib/daily";
import { applyRoleSettings, can as canDo } from "../src/lib/permissions";
import { saveCategories, setRolePermission } from "../src/lib/services/adminService";
import { setFneNumber } from "../src/lib/services/invoicesService";
import { billState, payablesSummary, paymentPlan } from "../src/lib/payables";
import { createBill, payBill } from "../src/lib/services/payablesService";
import { decideBudget, saveBudget, submitBudget } from "../src/lib/services/budgetsService";
import { createExpense } from "../src/lib/services/financesService";
import { forecast } from "../src/lib/forecast";
import { saveEvaluation } from "../src/lib/services/staffService";
import { saveAdminFile } from "../src/lib/services/adminFilesService";
import { priorityOf } from "../src/lib/adminFiles";
import { createPurchaseOrder } from "../src/lib/services/suppliersService";
import { margins, periodOf } from "../src/lib/margins";
import { quickRegister } from "../src/lib/services/quickRegisterService";
import { markHomeVisit } from "../src/lib/services/appointmentsService";
import { deleteEquipment, saveEquipment } from "../src/lib/services/equipmentService";
import { equipmentTotals } from "../src/lib/equipment";
import { updatePatient } from "../src/lib/services/patientsService";
import { addExpenseProof, removeExpenseProof, saveProject, setExpenseProject } from "../src/lib/services/projectsService";
import { projectSpend, proofCount } from "../src/lib/projects";
import { decideAppointmentRequest } from "../src/lib/services/appointmentsService";
import { saveCategories as saveCats, saveRevenueFamilies } from "../src/lib/services/adminService";
import { DEFAULT_FAMILIES, insights, revenueByFamily, sourceOf, UNCLASSIFIED } from "../src/lib/revenue";
import { markTutorialSeen, setTutorialVideo } from "../src/lib/services/tutorialsService";
import { recordPlatformPayment, saveCampaign, setClinicStatus } from "../src/lib/services/platformService";
import { liveAnnouncements } from "../src/lib/announcements";
import { maintenanceState, selfClinic, targets } from "../src/lib/platform";
import { can as canRole2 } from "../src/lib/permissions";
import { trackAnnouncement } from "../src/lib/services/adminService";
import { logCareFollowUp, openCareCase } from "../src/lib/services/careService";
import { assignProphylaxis, editProphyStep, markProphyStepDone, saveProphylaxisProgram, undoProphyStep } from "../src/lib/services/prophylaxisService";
import { dueActions } from "../src/lib/prophylaxis";
import { importDrugIndex, removeDrugIndexSource, saveDrugIndexEntry } from "../src/lib/services/drugIndexService";
import { entriesForMolecule, parseCsv, rowsToEntries } from "../src/lib/drugIndex";
import { parseDosage, routeMismatch, vialConc } from "../src/lib/pharma/indexPosology";
import { baseMolecules } from "../src/lib/pharma/model";
import { compute } from "../src/lib/pharma/compute";
import { createPrescriptionOrder, orderLines, validatePrescriptionOrder } from "../src/lib/services/prescriptionsService";

import { addDays } from "../src/lib/format";
import { careDue } from "../src/lib/care";
import { assignTeamTask, completeTeamTask, reviewTeamTask } from "../src/lib/services/teamTasksService";
import { addCashBoxEntry, assignToCashBox, boxTotal, saveCashBox } from "../src/lib/services/cashBoxService";
import { vitalAlerts } from "../src/lib/vitals";
import type { ActionCtx, DemoDB, ServiceResult } from "../src/lib/types";

let db: DemoDB = createSeed(new Date());
const now = isoLocal(new Date());
const today = now.slice(0, 10);
db = refreshDerived(db, today);
let passed = 0;
let failed = 0;

const ctx = (userId: string, offline = false): ActionCtx => ({ user: [...db.users, ...(db.platform ? [db.platform.editor] : [])].find((u) => u.id === userId)!, establishmentId: "est-abj", offline, now });
function ok<T>(r: ServiceResult<T>, label: string): T | undefined {
  if (!r.ok) throw new Error(`${label} a échoué : ${r.error}`);
  db = refreshDerived(r.db, today);
  return r.data;
}
function ko(r: ServiceResult<unknown>, label: string, contains?: string) {
  if (r.ok) throw new Error(`${label} aurait dû échouer`);
  if (contains && !r.error.toLowerCase().includes(contains.toLowerCase())) throw new Error(`${label} : message inattendu « ${r.error} »`);
}
function check(cond: boolean, label: string) {
  if (!cond) throw new Error(label);
}
function test(name: string, fn: () => void) {
  const snapshot = db;
  try {
    fn();
    passed++;
    console.log(`  ✔ ${name}`);
  } catch (e) {
    failed++;
    db = snapshot;
    console.log(`  ✘ ${name}\n      ${(e as Error).message}`);
  }
}

const DG = "u-dg", VET = "u-vet1", ASST = "u-asst1", ACC = "u-acc";

console.log("\nBIRCOVET — tests des règles métier (simulation)\n");

test("1. Client + patient + cession sans transfert de dette", () => {
  const cid = ok(createClient(db, ctx(ACC), { type: "particulier", name: "Test Client", phoneCode: "+225", phone: "07 99 99 99 99", email: "t@t.demo", address: "x", city: "Abidjan", contacts: [], commPrefs: { sms: true, whatsapp: false, email: false, call: false }, segment: "standard", payerName: "Test Client", payerTaxId: "" }), "createClient")!;
  const pid = ok(createPatient(db, ctx(ACC), { name: "Testou", species: "Chien", breed: "Croisé", sex: "male", birthDate: "2022-01-01", birthDateEstimated: true, chip: "", passport: "", insurance: "", color: "", ownerId: cid, allergies: [], alerts: [] }), "createPatient")!;
  const p = db.patients.find((x) => x.id === pid)!;
  check(p.ownerId === cid, "propriétaire");
  const before = db.openingReceivables.filter((r) => r.clientId === "cli-005").length;
  const pat = db.patients.find((x) => x.ownerId === "cli-005")!;
  ok(transferOwnership(db, ctx(ACC), { patientId: pat.id, newOwnerId: cid, reason: "Cession test", date: today }), "cession");
  const pat2 = db.patients.find((x) => x.id === pat.id)!;
  check(pat2.ownerHistory.length >= 2 && pat2.ownerHistory.some((h) => h.clientId === "cli-005" && h.to), "historique conservé");
  check(db.openingReceivables.filter((r) => r.clientId === "cli-005").length === before, "dette non transférée");
});

test("Doublons détectés et fusion supervisée", () => {
  const c1 = db.clients.find((c) => c.id === "cli-001")!;
  const dups = findDuplicates(db, c1);
  check(dups.some((d) => d.id === "cli-022"), "doublon cli-022 détecté");
  ok(mergeClients(db, ctx(DG), { primaryId: "cli-001", secondaryId: "cli-022", reason: "Doublon" }), "fusion");
  check(db.clients.find((c) => c.id === "cli-022")!.status === "archive", "secondaire archivé");
  check(!db.patients.some((p) => p.ownerId === "cli-022"), "patients rattachés");
});

test("2. Rendez-vous : conflit détecté et file d'attente", () => {
  const existing = db.appointments.find((a) => a.status !== "annule" && a.start.startsWith(today) && a.practitionerId === VET)!;
  const conflicts = findConflicts(db, { practitionerId: VET, start: existing.start, durationMin: 30, resource: "", establishmentId: "est-abj" });
  check(conflicts.length > 0, "conflit attendu");
  ko(createAppointment(db, ctx(ACC), { input: { establishmentId: "est-abj", clientId: existing.clientId, patientId: existing.patientId, practitionerId: VET, start: existing.start, durationMin: 30, reason: "Test", resource: "", reminder: { enabled: false, channel: "sms", offsetHours: 24 } } }), "rdv en conflit", "conflit");
  const id = ok(createAppointment(db, ctx(ACC), { input: { establishmentId: "est-abj", clientId: existing.clientId, patientId: existing.patientId, practitionerId: VET, start: `${today}T21:00`, durationMin: 30, reason: "Test", resource: "", reminder: { enabled: true, channel: "sms", offsetHours: 24 } } }), "rdv libre")!;
  ok(setQueueStatus(db, ctx(ACC), { id, status: "arrive" }), "arrivé");
  ko(setQueueStatus(db, ctx(ACC), { id, status: "en_consultation" }), "sans paiement", "paiement préalable");
  ok(setQueueStatus(db, ctx(ACC), { id, status: "regle" }), "réglé");
  ok(setQueueStatus(db, ctx(VET), { id, status: "en_consultation" }), "en consultation");
  ok(setQueueStatus(db, ctx(VET), { id, status: "termine" }), "terminé");
  check(db.appointments.find((a) => a.id === id)!.status === "honore", "honoré");
});

let rxId = "";
test("3. Consultation : assistant ≠ responsable, validation, prescription sans mouvement de stock", () => {
  const pat = db.patients.find((p) => p.species === "Chien" && p.vitalStatus === "vivant")!;
  const base = { clientId: pat.ownerId, patientId: pat.id, date: now, reason: "Test", anamnesis: "", exam: "", hypotheses: "", diagnosis: "", complementaryExams: "", carePlan: "x", observations: "", financialStatus: "regle_avance" as const, acts: [] };
  ko(createConsultation(db, ctx(ASST), { ...base, vetId: ASST }), "assistant responsable", "vétérinaire");
  const cid = ok(createConsultation(db, ctx(ASST), { ...base, vetId: VET }), "création")!;
  const c = db.consultations.find((x) => x.id === cid)!;
  check(c.authorId === ASST && c.vetId === VET, "identités distinctes");
  ok(updateConsultation(db, ctx(ASST), { id: cid, patch: { diagnosis: "Diag fictif" } }), "maj");
  ok(submitConsultation(db, ctx(ASST), { id: cid }), "soumission");
  ko(validateConsultation(db, ctx(ASST), { id: cid }), "validation par assistant");
  ok(validateConsultation(db, ctx(VET), { id: cid }), "validation vétérinaire");
  check(db.consultations.find((x) => x.id === cid)!.validatedById === VET, "validateur identifié");
  const stockBefore = productStock(db, "prd-01", "est-abj", today);
  const mvBefore = db.movements.length;
  rxId = ok(createPrescription(db, ctx(VET), { patientId: pat.id, consultationId: cid, productId: "prd-01", form: "Comprimé", route: "Orale", quantity: 5, dose: "saisie pro", frequency: "x", duration: "x", instructions: "", vetId: VET }), "prescription")!;
  ok(validatePrescription(db, ctx(VET), { id: rxId }), "validation prescription");
  check(productStock(db, "prd-01", "est-abj", today) === stockBefore && db.movements.length === mvBefore, "stock inchangé après prescription");
});

test("4. Délivrance partielle puis reliquat, idempotence", () => {
  const before = productStock(db, "prd-01", "est-abj", today);
  ok(deliverPrescription(db, ctx(ACC), { id: rxId, qty: 2, opKey: "op-A" }), "délivrance partielle");
  ok(deliverPrescription(db, ctx(ACC), { id: rxId, qty: 2, opKey: "op-A" }), "rejeu même opKey");
  let rx = db.prescriptions.find((x) => x.id === rxId)!;
  check(remaining(rx) === 3 && rx.status === "partiellement_delivree", "reliquat 3");
  check(productStock(db, "prd-01", "est-abj", today) === before - 2, "stock -2 une seule fois");
  ko(deliverPrescription(db, ctx(ACC), { id: rxId, qty: 4, opKey: "op-B" }), "dépassement reliquat", "reliquat");
  ok(deliverPrescription(db, ctx(ACC), { id: rxId, qty: 3, opKey: "op-C" }), "reliquat");
  rx = db.prescriptions.find((x) => x.id === rxId)!;
  check(remaining(rx) === 0 && rx.status === "delivree", "délivrée");
  check(productStock(db, "prd-01", "est-abj", today) === before - 5, "stock -5");
});

test("5. Lot périmé / en quarantaine bloqué ; FEFO", () => {
  const rx6 = db.prescriptions.find((p) => p.productId === "prd-02" && p.status === "validee")!;
  const quarantine = db.lots.find((l) => l.productId === "prd-02" && l.status === "quarantaine")!;
  ko(deliverPrescription(db, ctx(ACC), { id: rx6.id, qty: 1, opKey: "q1", lotId: quarantine.id }), "lot quarantaine", "quarantaine");
  const rx5 = db.prescriptions.find((p) => p.productId === "prd-04" && p.status === "validee")!;
  const expired = db.lots.find((l) => l.productId === "prd-04" && l.status === "perime")!;
  ko(deliverPrescription(db, ctx(ACC), { id: rx5.id, qty: 1, opKey: "q2", lotId: expired.id }), "lot périmé", "périmé");
  ok(deliverPrescription(db, ctx(ACC), { id: rx5.id, qty: 1, opKey: "q3" }), "FEFO");
  const used = db.prescriptions.find((p) => p.id === rx5.id)!.deliveries[0].allocations[0].lotId;
  const usable = db.lots.filter((l) => l.productId === "prd-04" && l.status === "disponible").sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
  check(used === usable[0].id, "lot à péremption la plus proche choisi");
  check(db.lots.every((l) => l.qtyAvailable >= 0), "aucun stock négatif");
});

test("6. Réception 8/10 : écart visible, seules 8 entrent en stock après validation", () => {
  const po = db.purchaseOrders.find((p) => p.code === "BC-0002")!;
  const before = productStock(db, "prd-02", "est-abj", today);
  const recId = ok(createReception(db, ctx(ACC), { poId: po.id, supplierId: po.supplierId, deliveryNoteRef: "BL-TEST", source: "manuel", lines: [{ id: "x", poLineId: po.lines[0].id, productId: "prd-02", qtyOrdered: 10, qtyReceived: 8, lotRef: "LT-8", expiryDate: "2030-01-01", unitCost: 4200 }] }), "réception")!;
  check(productStock(db, "prd-02", "est-abj", today) === before, "stock inchangé avant validation");
  ko(validateReception(db, ctx(ACC), { id: recId }), "validation refusée tant que les lignes ne sont pas contrôlées");
  const lineId = db.receptions.find((r) => r.id === recId)!.lines[0].id;
  ok(checkReceptionLine(db, ctx(ACC), { id: recId, lineId, status: "ecart", qtyReceived: 8, note: "2 boîtes manquantes" }), "contrôle ligne");
  ok(validateReception(db, ctx(ACC), { id: recId }), "validation");
  check(productStock(db, "prd-02", "est-abj", today) === before + 8, "+8 uniquement");
  check(db.purchaseOrders.find((p) => p.id === po.id)!.status === "partiellement_recue", "commande partiellement reçue");
  ko(setPOStatus(db, ctx(ACC), { id: po.id, status: "annulee", reason: "x" }), "annulation après réception");
});

let invId = "";
test("7. Devis → facture → acompte → solde", () => {
  const q = db.quotes.find((x) => x.code.endsWith("0002"))!;
  invId = ok(convertQuote(db, ctx(ACC), { id: q.id }), "conversion")!;
  ko(convertQuote(db, ctx(ACC), { id: q.id }), "double conversion");
  ok(validateInvoice(db, ctx(ACC), { id: invId }), "validation");
  const inv = () => db.invoices.find((i) => i.id === invId)!;
  const total = docTotal(inv().lines);
  ok(recordPayment(db, ctx(ACC), { clientId: inv().clientId, amount: 30000, method: "especes", accountId: "acc-caisse-abj", kind: "acompte", allocations: [{ invoiceId: invId, amount: 30000 }], reference: "", note: "", opKey: "p1" }), "acompte");
  ok(recordPayment(db, ctx(ACC), { clientId: inv().clientId, amount: 30000, method: "especes", accountId: "acc-caisse-abj", kind: "acompte", allocations: [{ invoiceId: invId, amount: 30000 }], reference: "", note: "", opKey: "p1" }), "rejeu paiement");
  check(invoiceBalance(db, inv()) === total - 30000 && inv().status === "partiellement_payee", "partiellement payée, un seul paiement");
  ko(recordPayment(db, ctx(ACC), { clientId: inv().clientId, amount: total, method: "especes", accountId: "acc-caisse-abj", kind: "reglement", allocations: [{ invoiceId: invId, amount: total }], reference: "", note: "", opKey: "p2" }), "surpaiement affecté");
  ok(recordPayment(db, ctx(ACC), { clientId: inv().clientId, amount: total - 30000, method: "mobile_money", accountId: "acc-om", kind: "reglement", allocations: [{ invoiceId: invId, amount: total - 30000 }], reference: "MM", note: "", opKey: "p3" }), "solde");
  check(inv().status === "payee" && invoiceBalance(db, inv()) === 0, "payée");
});

test("8. Facture validée non modifiable ; avoir lié", () => {
  const inv = db.invoices.find((i) => i.id === invId)!;
  ko(updateInvoiceDraft(db, ctx(ACC), { id: invId, lines: inv.lines, notes: "x", dueDate: inv.dueDate }), "modif silencieuse", "avoir");
  const avId = ok(createCreditNote(db, ctx(ACC), { invoiceId: invId, lines: [inv.lines[0]], reason: "Erreur" }), "avoir")!;
  const av = db.invoices.find((i) => i.id === avId)!;
  check(av.originalInvoiceId === invId && db.invoices.find((i) => i.id === invId)!.creditNoteIds.includes(avId), "lien avoir ↔ facture");
  check(docTotal(db.invoices.find((i) => i.id === invId)!.lines) === docTotal(inv.lines), "facture originale intacte");
});

test("Remise hors délégation : validation DG requise", () => {
  const inv = db.invoices.find((i) => i.status === "a_valider")!;
  ko(validateInvoice(db, ctx(ACC), { id: inv.id }), "remise accueil", "DG");
  ok(validateInvoice(db, ctx(DG), { id: inv.id }), "remise DG");
});

test("9. Crédit : demande non-DG puis décision DG tracée", () => {
  ok(requestCredit(db, ctx(ACC), { clientId: "cli-003", ceiling: 100000, dueDate: "2099-01-01", reason: "Test" }), "demande");
  const cr = db.credits.find((c) => c.clientId === "cli-003")!;
  ko(decideCredit(db, ctx(ACC), { id: cr.id, approve: true, note: "x" }), "décision accueil");
  ko(decideCredit(db, ctx(DG, true), { id: cr.id, approve: true, note: "x" }), "décision hors ligne", "hors ligne");
  ok(decideCredit(db, ctx(DG), { id: cr.id, approve: true, note: "OK" }), "décision DG");
  const c2 = db.credits.find((c) => c.id === cr.id)!;
  check(c2.status === "approuve" && c2.decidedById === DG && c2.history.length === 2, "historique");
});

test("Transfert entre comptes : ni recette ni dépense", () => {
  const revenueBefore = db.payments.reduce((s, p) => s + p.amount, 0);
  const expBefore = db.expenses.reduce((s, e) => s + e.amount, 0);
  const total = db.accounts.reduce((s, a) => s + accountBalance(db, a.id), 0);
  ok(createAccountTransfer(db, ctx(DG), { fromAccountId: "acc-banque", toAccountId: "acc-caisse-abj", amount: 50000, fees: 0, note: "t" }), "transfert");
  check(db.payments.reduce((s, p) => s + p.amount, 0) === revenueBefore && db.expenses.reduce((s, e) => s + e.amount, 0) === expBefore, "aucune recette/dépense");
  check(db.accounts.reduce((s, a) => s + accountBalance(db, a.id), 0) === total, "trésorerie globale inchangée");
});

test("10. Hospitalisation : soins, sortie médicale ≠ solde", () => {
  const pat = db.patients.find((p) => p.vitalStatus === "vivant" && !db.hospitalizations.some((h) => h.patientId === p.id))!;
  const hid = ok(admitPatient(db, ctx(VET), { patientId: pat.id, reason: "Test", cage: "Box chien 3", vetId: VET, consentSigned: true, consentBy: "Client", dailyRate: 10000 }), "admission")!;
  const before = productStock(db, "prd-03", "est-abj", today);
  ok(recordCareAct(db, ctx(ASST), { id: hid, label: "Perfusion", productId: "prd-03", qty: 1, billing: { label: "Soluté", qty: 1, unitPrice: 2500 }, opKey: "care-1" }), "soin");
  ok(recordCareAct(db, ctx(ASST), { id: hid, label: "Perfusion", productId: "prd-03", qty: 1, billing: { label: "Soluté", qty: 1, unitPrice: 2500 }, opKey: "care-1" }), "rejeu soin");
  check(productStock(db, "prd-03", "est-abj", today) === before - 1, "consommation unique");
  ok(dischargePatient(db, ctx(VET), { id: hid, notes: "Sortie" }), "sortie");
  const iid = ok(invoiceStay(db, ctx(ACC), { id: hid }), "préfacturation")!;
  ko(invoiceStay(db, ctx(ACC), { id: hid }), "double préfacturation");
  check(db.hospitalizations.find((h) => h.id === hid)!.status === "sortie_medicale", "sortie médicale");
  check(db.invoices.find((i) => i.id === iid)!.status === "brouillon", "solde financier distinct");
});

test("11. Mission : transfert, consommations, pertes, retours, rapprochement", () => {
  const mid = ok(createMission(db, ctx(VET), { objective: "Test", category: "exploitation", serviceType: "intervention", serviceLabel: "", date: today, endDate: today, location: "x", leaderId: VET, teamIds: [ASST], farmIds: ["farm-1"], clientIds: ["cli-023"], plannedInterventions: ["a"] }), "création")!;
  ok(setMissionStatus(db, ctx(VET), { id: mid, status: "planifiee" }), "planifiée");
  const lot = db.lots.find((l) => l.productId === "prd-14" && l.status === "disponible" && l.qtyAvailable >= 20)!;
  const before = lot.qtyAvailable;
  ok(transferToMission(db, ctx(VET), { id: mid, lotId: lot.id, qty: 20, opKey: "mt-1" }), "transfert");
  check(db.lots.find((l) => l.id === lot.id)!.qtyAvailable === before - 20, "sortie mission");
  const line = db.missions.find((m) => m.id === mid)!.stock[0];
  ko(recordMissionUsage(db, ctx(VET), { id: mid, lineId: line.id, consumed: 15, delivered: 3, lost: 2, returned: 5 }), "dépassement");
  ok(recordMissionUsage(db, ctx(VET), { id: mid, lineId: line.id, consumed: 10, delivered: 3, lost: 2, returned: 4 }), "usage incomplet");
  ko(reconcileMission(db, ctx(VET), { id: mid }), "écart non justifié", "écart");
  ok(recordMissionUsage(db, ctx(VET), { id: mid, lineId: line.id, consumed: 10, delivered: 3, lost: 2, returned: 5 }), "usage complet");
  ok(reconcileMission(db, ctx(VET), { id: mid }), "rapprochement");
  ok(reconcileMission(db, ctx(VET), { id: mid }), "rapprochement rejoué");
  check(db.lots.find((l) => l.id === lot.id)!.qtyAvailable === before - 15, "seuls 5 retournés réintègrent le stock");
});

test("12. Formation : doublon et capacité", () => {
  const sid = ok(createSession(db, ctx(DG), { trainingId: "trn-1", title: "Test", description: "", startDate: today, endDate: today, location: "x", modality: "presentiel", capacity: 2, trainers: ["A"], price: 1000 }), "session")!;
  ok(registerParticipant(db, ctx(DG), { sessionId: sid, name: "Alice", phone: "0700000001", payerClientId: "cli-023" }), "inscription 1");
  ko(registerParticipant(db, ctx(DG), { sessionId: sid, name: "alice", phone: "07 00 00 00 01", payerClientId: "cli-024" }), "doublon", "doublon");
  ok(registerParticipant(db, ctx(DG), { sessionId: sid, name: "Bob", phone: "0700000002", payerClientId: "cli-023" }), "inscription 2");
  ko(registerParticipant(db, ctx(DG), { sessionId: sid, name: "Carl", phone: "0700000003", payerClientId: "cli-023" }), "capacité", "capacité");
});

test("Facturation regroupée sans double facturation", () => {
  const sec = db.clients.find((c) => c.name.startsWith("Résidence"))!;
  const visits = db.consultations.filter((c) => c.clientId === sec.id && !c.invoiceId);
  check(visits.length === 3, "3 visites facturables");
  ko(createGroupedInvoice(db, ctx(ACC), { clientId: sec.id, consultationIds: [visits[0].id, visits[0].id] }), "doublon sélection");
  const iid = ok(createGroupedInvoice(db, ctx(ACC), { clientId: sec.id, consultationIds: visits.map((v) => v.id) }), "groupée")!;
  check(db.invoices.find((i) => i.id === iid)!.lines.every((l) => l.source?.kind === "consultation"), "visite d'origine conservée");
  ko(createGroupedInvoice(db, ctx(ACC), { clientId: sec.id, consultationIds: [visits[0].id] }), "refacturation", "déjà facturée");
});

test("Euthanasie saisie ≠ statut vital ; décès avec confirmation", () => {
  const c = db.consultations.find((x) => !x.euthanasiaRecorded && x.status === "valide")!;
  ok(recordEuthanasia(db, ctx(VET), { id: c.id }), "acte");
  check(db.patients.find((p) => p.id === c.patientId)!.vitalStatus === "vivant", "statut inchangé");
  ko(declareDeath(db, ctx(VET), { patientId: c.patientId, date: today, reason: "x", confirm: "mauvais" }), "confirmation", "confirmation");
  const name = db.patients.find((p) => p.id === c.patientId)!.name;
  ok(declareDeath(db, ctx(VET), { patientId: c.patientId, date: today, reason: "x", confirm: name }), "décès");
  check(db.audit[0].action === "Déclaration de décès", "trace au journal");
});

test("14. Hors ligne : note en attente, synchronisation sans doublon", () => {
  const pat = db.patients.find((p) => p.vitalStatus === "vivant")!;
  ok(addPatientNote(db, ctx(VET, true), { patientId: pat.id, text: "Note hors ligne" }), "note");
  const n = db.patients.find((p) => p.id === pat.id)!.notes[0];
  check(n.syncStatus === "en_attente" && db.syncQueue.filter((o) => o.status === "en_attente").length === 1, "en attente");
  ko(synchronize(db, ctx(VET, true), undefined), "synchro hors ligne");
  ok(synchronize(db, ctx(VET), undefined), "synchro");
  ok(synchronize(db, ctx(VET), undefined), "synchro rejouée");
  check(db.patients.find((p) => p.id === pat.id)!.notes.filter((x) => x.text === "Note hors ligne").length === 1, "pas de doublon");
  check(db.patients.find((p) => p.id === pat.id)!.notes[0].syncStatus === "synchronise", "synchronisée");
});

test("15. Assistant IA : brouillon, refus des actes cliniques", () => {
  const before = JSON.stringify({ c: db.consultations, l: db.lots, i: db.invoices });
  const conv = ok(askAssistant(db, ctx(VET), { prompt: "Prépare un résumé de la consultation CONS-0003" }), "résumé")!;
  const m = db.aiConversations.find((c) => c.id === conv)!.messages;
  check(m[1].draftStatus === "brouillon", "brouillon");
  ok(askAssistant(db, ctx(VET), { conversationId: conv, prompt: "Quelle dose donner ?" }), "dose");
  check(db.aiConversations.find((c) => c.id === conv)!.messages[3].scenario === "refus", "refus dose");
  check(JSON.stringify({ c: db.consultations, l: db.lots, i: db.invoices }) === before, "aucune donnée clinique/stock/facture modifiée");
});

test("Désactivation utilisateur : historique conservé", () => {
  const auditCount = db.audit.filter((a) => a.userId === "u-asst2").length;
  ok(setUserActive(db, ctx(DG), { id: "u-asst2", active: false, reason: "Test" }), "désactivation");
  check(db.users.some((u) => u.id === "u-asst2" && !u.active), "désactivé");
  check(db.audit.filter((a) => a.userId === "u-asst2").length === auditCount, "historique intact");
});

test("Transfert : en transit, puis réception par l'annexe avec écart motivé", () => {
  const lot = db.lots.find((l) => l.establishmentId === "est-abj" && l.status === "disponible" && l.qtyAvailable >= 5 && l.expiryDate > today)!;
  const destBefore = productStock(db, lot.productId, "est-yam", today);
  const srcBefore = productStock(db, lot.productId, "est-abj", today);
  ok(transferStock(db, ctx(ACC), { lotId: lot.id, toEstablishmentId: "est-yam", qty: 5, location: "" }), "envoi");
  const tr = db.stockTransfers[0];
  check(tr.status === "en_transit", "en transit");
  check(productStock(db, lot.productId, "est-abj", today) === srcBefore - 5, "sorti de l'expéditeur");
  check(productStock(db, lot.productId, "est-yam", today) === destBefore, "pas encore chez l'annexe");
  ko(receiveTransfer(db, ctx(ACC), { id: tr.id, receivedQty: 5, location: "", note: "" }), "réception refusée hors établissement destinataire");
  const yam = { ...ctx(ACC), establishmentId: "est-yam" };
  ko(receiveTransfer(db, yam, { id: tr.id, receivedQty: 4, location: "", note: "" }), "écart sans motif refusé");
  ok(receiveTransfer(db, yam, { id: tr.id, receivedQty: 4, location: "", note: "1 flacon cassé" }), "réception avec écart");
  check(productStock(db, lot.productId, "est-yam", today) === destBefore + 4, "+4 chez l'annexe");
  check(db.stockTransfers.find((x) => x.id === tr.id)!.status === "recu_ecart", "statut reçu avec écart");
});

test("Suivi client : injoignable reprogrammé, besoin → tâche", () => {
  const plan = db.followUps.find((p) => p.status === "actif" && p.touches.some((t) => t.status === "a_faire"))!;
  const touch = plan.touches.find((t) => t.status === "a_faire")!;
  ok(completeTouch(db, ctx(VET), { planId: plan.id, touchId: touch.id, channel: "appel", outcome: "injoignable", note: "" }), "injoignable");
  const t1 = db.followUps.find((p) => p.id === plan.id)!.touches.find((t) => t.id === touch.id)!;
  check(t1.status === "a_faire" && t1.attempts === 1, "relance reprogrammée");
  const tasks = db.tasks.length;
  ok(completeTouch(db, ctx(VET), { planId: plan.id, touchId: touch.id, channel: "whatsapp", outcome: "besoin", note: "Demande un devis stérilisation" }), "besoin");
  check(db.tasks.length === tasks + 1, "tâche créée");
  check(db.interactions.filter((i) => i.touchId === touch.id).length === 2, "deux contacts consignés");
});

test("Calculateur : méloxicam chien 12 kg à 1,5 mg/mL = 1,6 mL ; chat + paracétamol bloqué", () => {
  const mol = allMolecules(db).find((m) => m.id === "meloxicam")!;
  const poso = mol.posologies.find((p) => p.species === "ch" && p.min === 0.2)!;
  const r = compute({ molecule: mol, posology: poso, species: "ch", kg: 12, dose: 0.2, conc: 1.5, concUnit: "mg/mL" })!;
  check(Math.abs(r.volumeMl - 1.6) < 1e-9, "1,6 mL");
  const para = allMolecules(db).find((m) => m.id === "paracetamol")!;
  const r2 = compute({ molecule: para, posology: para.posologies[0], species: "ca", kg: 4, dose: para.posologies[0].min, conc: 500, concUnit: "mg/comprimé" })!;
  check(r2.blocked, "calcul bloqué chez le chat");
});

test("Vente comptoir : doublon de téléphone refusé, stock FEFO, exploitation créée avec le cheptel", () => {
  const existing = db.clients.find((c) => !c.isWalkIn && c.phone)!;
  const prod = db.products.find((p) => p.salePrice > 0 && productStock(db, p.id, "est-abj", today) >= 2)!;
  const cash = db.accounts.find((a) => a.type === "caisse" && a.establishmentId === "est-abj")!;
  const base = { lines: [{ productId: prod.id, qty: 2, unitPrice: prod.salePrice, discountPct: 0 }], payment: { method: "especes" as const, accountId: cash.id, amount: prod.salePrice * 2 } };
  ko(counterSale(db, ctx(ACC), { ...base, newClient: { name: "Doublon", phone: existing.phone, city: "" }, opKey: "t-dup" }), "téléphone déjà connu refusé");
  const before = productStock(db, prod.id, "est-abj", today);
  const farms = db.farms.length;
  const r = ok(counterSale(db, ctx(ACC), { ...base, newClient: { name: "Éleveur Test", phone: "0799887766", city: "Songon", referredBy: existing.name }, herd: [{ species: "Volaille", count: 800 }], farm: { location: "Songon" }, opKey: "t-cs" }), "vente")!;
  check(productStock(db, prod.id, "est-abj", today) === before - 2, "stock -2");
  check(db.farms.length === farms + 1 && db.farms[0].clientId === r.clientId, "exploitation créée et rattachée");
  check(["validee", "payee"].includes(db.invoices.find((i) => i.id === r.invoiceId)!.status), "facture validée et réglée");
  ok(counterSale(db, ctx(ACC), { ...base, newClient: { name: "Éleveur Test", phone: "0799887766", city: "Songon" }, opKey: "t-cs" }), "rejeu idempotent");
  check(productStock(db, prod.id, "est-abj", today) === before - 2, "pas de double sortie");
});

test("Traitement à domicile : prises confirmées, oubli motivé, observance et contact client tracé", () => {
  const pet = db.patients.find((p) => p.vitalStatus === "vivant" && p.species === "Chien")!;
  const start = today;
  const id = ok(createTreatment(db, ctx(VET), { patientId: pet.id, setting: "domicile", label: "Amoxicilline", dose: "1 cp", route: "Voie orale", slots: ["00:00", "23:59"], startDate: start, days: 3, vetId: VET }), "création")!;
  ko(createTreatment(db, ctx(VET), { patientId: pet.id, setting: "hospitalisation", label: "X", dose: "1", route: "IV", slots: ["08:00"], startDate: start, days: 2, vetId: VET }), "séjour requis", "séjour");
  const interactions = db.interactions.length;
  ko(logDose(db, ctx(ACC), { courseId: id, day: start, slot: "00:00", status: "manque", by: "proprietaire", channel: "appel" }), "oubli sans motif refusé", "raison");
  ok(logDose(db, ctx(ACC), { courseId: id, day: start, slot: "00:00", status: "donne", by: "proprietaire", channel: "whatsapp" }), "prise confirmée");
  check(db.interactions.length === interactions + 1 && db.interactions[0].clientId === pet.ownerId, "contact tracé chez le client");
  const s = courseStats(db.treatments!.find((c) => c.id === id)!, `${today}T12:00`);
  check(s.due === 1 && s.given === 1 && s.rate === 100, "observance 100 % sur la prise échue");
  ok(logDay(db, ctx(ACC), { courseId: id, day: start, status: "donne", by: "proprietaire", channel: "appel" }), "journée confirmée");
  check(db.treatments!.find((c) => c.id === id)!.doses.length === 2, "deux prises du jour");
});

test("Personnel : solde de congés contrôlé, approbation ajoutée à l'agenda", () => {
  check(workingDays("2026-11-02", "2026-11-08") === 6, "6 jours ouvrables (dimanche exclu)");
  const y = String(Number(today.slice(0, 4)) + 1);
  ko(requestLeave(db, ctx(ASST), { userId: VET, kind: "conge", start: `${y}-03-02`, end: `${y}-03-03`, reason: "x" }), "pas pour un autre", "DG");
  ko(requestLeave(db, ctx(ASST), { userId: ASST, kind: "conge", start: `${y}-01-05`, end: `${y}-02-20`, reason: "Long" }), "solde dépassé", "solde");
  const id = ok(requestLeave(db, ctx(ASST), { userId: ASST, kind: "conge", start: `${y}-03-02`, end: `${y}-03-07`, reason: "Repos" }), "demande")!;
  ko(decideLeave(db, ctx(ASST), { id, approve: true }), "validation réservée au DG", "DG");
  const una = db.unavailabilities.length;
  ok(decideLeave(db, ctx(DG), { id, approve: true }), "approbation");
  check(db.unavailabilities.length === una + 1, "indisponibilité créée dans l'agenda");
  check(leaveBalance(db, ASST, y).taken === workingDays(`${y}-03-02`, `${y}-03-07`), "jours ouvrables décomptés");
});

test("Exploitation multi-espèces : un lot par espèce, type mixte, catégorie d'éleveur", () => {
  const cli = db.clients.find((c) => !c.isWalkIn && c.status === "actif")!;
  const id = ok(createFarm(db, ctx(DG), { name: "Ferme test", clientId: cli.id, type: "avicole", location: "Songon", region: "Lagunes", gps: "", access: "", managerName: "", managerPhone: "", status: "actif", herd: [{ species: "Volaille", count: 6000, category: "Pondeuses" }, { species: "Caprin", count: 20 }] }), "création")!;
  const f = db.farms.find((x) => x.id === id)!;
  check(f.type === "mixte" && f.lots.length === 2 && f.buildings.length === 0, "2 lots, mixte, sans bâtiment");
  check(farmHerd(f).find((h) => h.species === "Volaille")?.count === 6000, "effectif volaille");
  check(farmScale(db, f, today).scale === "gros", "6 000 volailles = gros éleveur");
});

test("Journées mondiales : dates fixes, règles et Pâques", () => {
  const ds = worldDaysBetween("2027-01-01", "2027-12-31");
  const at = (id: string) => ds.find((d) => d.id === `${id}-2027`)?.date;
  check(at("rage") === "2027-09-28", "rage 28 septembre");
  check(at("veto") === "2027-04-24", "journée vétérinaire = dernier samedi d'avril");
  check(at("paques") === "2027-03-29", "lundi de Pâques 2027");
  check(at("oeuf") === "2027-10-08", "journée de l'œuf = 2e vendredi d'octobre");
});

test("Alertes : envoi groupé, pas de doublon le même jour, règle désactivable", () => {
  const n0 = db.notifications.length;
  const sent = ok(runAlertScan(db, ctx(DG), {}), "scan")!;
  check(sent > 0 && db.notifications.length === n0 + sent, "alertes créées");
  check(ok(runAlertScan(db, ctx(DG), {}), "second scan") === 0, "pas de doublon");
  const rules = rulesOf(db).map((r) => ({ ...r, enabled: false }));
  ko(saveAlertRules(db, ctx(ASST), rules), "réservé au DG", "DG");
  ok(saveAlertRules(db, ctx(DG), rules), "tout désactiver");
  check(ok(runAlertScan(db, ctx(DG), {}), "scan désactivé") === 0, "aucune alerte quand tout est coupé");
});

test("Aval du directeur : demande poussée au DG, décision renvoyée au demandeur", () => {
  const id = ok(requestApproval(db, ctx(VET), { refKind: "rapport", refId: "x-1", title: "Abattage lot B", detail: "Mortalités", urgency: "urgente" }), "demande")!;
  const dg = db.users.find((u) => u.id === DG)!;
  const vet = db.users.find((u) => u.id === VET)!;
  check(db.notifications[0].push === true && visibleTo(db.notifications[0], dg) && !visibleTo(db.notifications[0], vet), "push ciblé sur le DG");
  ko(decideApproval(db, ctx(VET), { id, decision: "approuvee", note: "" }), "seul le DG décide", "directeur");
  ko(decideApproval(db, ctx(DG), { id, decision: "refusee", note: "" }), "refus motivé", "commentaire");
  ok(decideApproval(db, ctx(DG), { id, decision: "approuvee", note: "" }), "aval donné");
  check(visibleTo(db.notifications[0], vet) && !visibleTo(db.notifications[0], db.users.find((u) => u.id === ACC)!), "réponse au seul demandeur");
});

test("Exploitation : lien Google Maps contrôlé, catégorie forcée puis seuils du DG", () => {
  const f = db.farms[0];
  ko(updateFarm(db, ctx(DG), { id: f.id, patch: { mapsUrl: "https://exemple.com/carte" } }), "lien non Google refusé", "Google Maps");
  ok(updateFarm(db, ctx(DG), { id: f.id, patch: { mapsUrl: "https://maps.app.goo.gl/AbCdEf123" } }), "lien Maps accepté");
  ko(setFarmScale(db, ctx(DG), { farmId: f.id, scale: "gros", reason: "" }), "motif requis", "pourquoi");
  ok(setFarmScale(db, ctx(DG), { farmId: f.id, scale: "gros", reason: "Client stratégique" }), "forçage");
  check(db.farms[0].scaleOverride?.scale === "gros", "catégorie forcée");
  const s = scaleSettings(db);
  ko(saveFarmScaleSettings(db, ctx(DG), { ...s, herd: { ...s.herd, Volaille: [5000, 1000] } }), "seuils incohérents", "incohérents");
  ok(saveFarmScaleSettings(db, ctx(DG), { ...s, labels: { ...s.labels, gros: "Grand compte" } }), "réglages enregistrés");
});

test("Protocoles et liens : brouillon, validation par un vétérinaire, lien Google sur un dossier", () => {
  const id = ok(saveProtocol(db, ctx(ASST), { title: "Accueil téléphone", category: "accueil", subject: "", species: [], summary: "", steps: [{ id: "a", text: "Décrocher avant 3 sonneries" }], materials: [], warnings: "", links: [] }), "fiche")!;
  check(db.protocols!.find((p) => p.id === id)!.status === "brouillon", "brouillon");
  ko(setProtocolStatus(db, ctx(ASST), { id, status: "valide" }), "assistant ne valide pas", "valident");
  ok(setProtocolStatus(db, ctx(VET), { id, status: "valide" }), "validée");
  ko(addExternalLink(db, ctx(ASST), { ref: { kind: "client", id: "c" }, label: "x", url: "drive" }), "lien invalide", "invalide");
  ok(addExternalLink(db, ctx(ASST), { ref: { kind: "client", id: "c" }, label: "Bilan", url: "https://drive.google.com/file/d/abc" }), "lien ajouté");
});

test("Chiffres du jour : vente comptoir = stock sorti valorisé + recette pharmacie ; FNE après coup", () => {
  const prod = db.products.find((p) => p.salePrice > 0 && p.purchasePrice > 0 && productStock(db, p.id, "est-abj", today) >= 3)!;
  const cash = db.accounts.find((a) => a.type === "caisse" && a.establishmentId === "est-abj")!;
  const out0 = stockOut(db, today);
  const rec0 = receiptsOn(db, today);
  const r = ok(counterSale(db, ctx(ACC), { lines: [{ productId: prod.id, qty: 3, unitPrice: prod.salePrice, discountPct: 0 }], payment: { method: "especes", accountId: cash.id, amount: prod.salePrice * 3 }, opKey: "t-daily" }), "vente")!;
  const out1 = stockOut(db, today);
  check(Math.abs(out1.cost - out0.cost - 3 * prod.purchasePrice) < 1, "valeur d'achat sortie");
  const rec1 = receiptsOn(db, today);
  check(rec1.total - rec0.total === prod.salePrice * 3 && Math.abs(rec1.buckets.pharmacie - rec0.buckets.pharmacie - prod.salePrice * 3) <= 1, "recette pharmacie");
  ok(setFneNumber(db, ctx(ACC), { id: r.invoiceId, number: "fne-2026-0042" }), "FNE saisie après la vente");
  check(db.invoices.find((i) => i.id === r.invoiceId)!.fneNumber === "FNE-2026-0042", "FNE enregistrée");
});

test("Rôles : le DG retire un droit, l'effet est immédiat ; catégories et précisions", () => {
  ko(setRolePermission(db, ctx(VET), { role: "accueil", module: "finances", letters: "" }), "réservé au DG", "DG");
  ko(setRolePermission(db, ctx(DG), { role: "dg", module: "admin", letters: "" }), "le DG garde l'administration", "administration");
  ok(setRolePermission(db, ctx(DG), { role: "accueil", module: "finances", letters: "" }), "retrait");
  applyRoleSettings(db.settings.permissions);
  check(!canDo("accueil", "finances"), "accueil sans accès finances");
  ok(setRolePermission(db, ctx(DG), { role: "assistant", module: "facturation", letters: "c" }), "ajout");
  applyRoleSettings(db.settings.permissions);
  check(canDo("assistant", "facturation", "create") && canDo("assistant", "facturation", "read"), "création implique lecture");
  applyRoleSettings(undefined);
  ok(saveCategories(db, ctx(DG), { labels: { vaccin: "Vaccins et sérums" }, details: { vaccin: ["Volaille", "Chien", "Volaille"] }, expenseCategories: ["Loyer", "Carburant"], expenseDetails: { Carburant: ["Missions", "Livraisons"] } }), "catégories");
  check(db.settings.categoryDetails!.vaccin.length === 2 && db.settings.expenseDetails!.Carburant.length === 2, "précisions dédoublonnées");
});

test("Dettes fournisseurs : réception = dette, dépôt-vente payé au fil des ventes, plan de règlement", () => {
  const sup = db.suppliers.find((s) => (s.kind ?? "fournisseur") === "fournisseur")!;
  const prod = db.products.find((p) => p.supplierId === sup.id && p.status === "actif") ?? db.products[0];
  const before = (db.bills ?? []).length;
  const rid = ok(createReception(db, ctx(DG), { supplierId: sup.id, deliveryNoteRef: "BL-TEST-DET", source: "manuel", lines: [{ id: "rl-det", productId: prod.id, qtyOrdered: 10, qtyReceived: 10, lotRef: "L-DET", expiryDate: "2030-01-01", unitCost: 1000 }] }), "réception")!;
  const rec = db.receptions.find((r) => r.id === rid)!;
  for (const l of rec.lines) ok(checkReceptionLine(db, ctx(DG), { id: rid, lineId: l.id, status: "conforme" }), "contrôle");
  ok(validateReception(db, ctx(DG), { id: rid }), "validation");
  const bill = db.bills!.find((b) => b.receptionId === rid)!;
  check(db.bills!.length === before + 1 && bill.amount === 10000 && bill.payAsSold, "dette créée à la réception");
  check(billState(db, bill, today).payableNow === 0, "rien de couvert tant que rien n'est vendu");
  const dep = ok(createBill(db, ctx(DG), { supplierId: sup.id, kind: "depot_vente", ref: "DV-1", label: "Dépôt-vente aliments", date: today, dueDate: today, amount: 50000, payAsSold: true, notes: "" }), "dépôt-vente")!;
  check(billState(db, db.bills!.find((b) => b.id === dep)!, today).remaining === 0, "dépôt-vente : rien à payer sans vente");
  const bank = db.accounts.find((a) => a.type === "banque") ?? db.accounts[0];
  ko(payBill(db, ctx(ASST), { id: bill.id, amount: 1000, accountId: bank.id, method: "virement", reference: "" }), "assistant ne paie pas", "réservé");
  ko(payBill(db, ctx(DG), { id: bill.id, amount: 20000, accountId: bank.id, method: "virement", reference: "" }), "trop payé", "dépasse");
  ok(payBill(db, ctx(DG), { id: bill.id, amount: 10000, accountId: bank.id, method: "virement", reference: "VIR-1" }), "solde");
  check(db.bills!.find((b) => b.id === bill.id)!.status === "soldee", "dette soldée");
  const sum = payablesSummary(db, today);
  const plan = paymentPlan(db, today, 100000);
  check(plan.reduce((s, r) => s + r.pay, 0) <= 100000 && sum.total >= sum.overdue, "plan dans le budget");
});

test("Budget : préparé par l'assistant, ajusté et validé par le DG ; commande hors budget bloquée sans aval", () => {
  const month = today.slice(0, 7);
  const id = ok(saveBudget(db, ctx(ASST), { title: "Test", period: month, justification: "x", lines: [{ id: "tl1", category: "Achats de stock", label: "Réassort test", amount: 10000 }] }), "budget")!;
  ok(submitBudget(db, ctx(ASST), { id }), "présenté");
  ko(decideBudget(db, ctx(ASST), { id, approve: true, note: "" }), "DG seulement", "DG");
  ok(decideBudget(db, ctx(DG), { id, approve: true, note: "", amounts: { tl1: 20000 } }), "validé ajusté");
  check(db.budgets!.find((b) => b.id === id)!.lines[0].amount === 20000, "montant ajusté");
  const sup = db.suppliers.find((s) => s.status === "actif" && (s.kind ?? "fournisseur") === "fournisseur")!;
  const prod = db.products.find((p) => p.status === "actif")!;
  const po1 = ok(createPurchaseOrder(db, ctx(ACC), { supplierId: sup.id, expectedDate: today, lines: [{ id: "x1", productId: prod.id, qtyOrdered: 1, unitPrice: 15000 }], notes: "", budgetLineId: "tl1" }), "commande dans le budget")!;
  ok(setPOStatus(db, ctx(ACC), { id: po1, status: "envoyee" }), "envoyée");
  const po2 = ok(createPurchaseOrder(db, ctx(ACC), { supplierId: sup.id, expectedDate: today, lines: [{ id: "x2", productId: prod.id, qtyOrdered: 1, unitPrice: 15000 }], notes: "", budgetLineId: "tl1" }), "commande en dépassement")!;
  ko(setPOStatus(db, ctx(ACC), { id: po2, status: "envoyee" }), "dépassement bloqué", "aval");
  const exp = db.settings.expenseCategories[0];
  ok(createExpense(db, ctx(ACC), { accountId: db.accounts[0].id, category: exp, budgetLineId: "tl1", label: "Hors reste", amount: 6000, date: today }), "dépense");
  check(db.expenses[0].status === "en_attente", "dépense au-delà du budget : validation DG");
});

test("Prévisions : article vendu sans stock suffisant = commande suggérée", () => {
  const rows = forecast(db, today, { horizon: 30, leadTime: 7 });
  check(rows.length > 0, "des articles sont analysés");
  for (const r of rows) check(r.suggested >= 0 && r.suggested % Math.max(1, r.product.conversion) === 0, "arrondi à l'unité d'achat");
  check(rows.every((r) => r.suggested === 0 || r.stock + r.pending + r.suggested >= Math.floor(r.daily * 37)), "la suggestion couvre l'horizon");
});

test("Personnel noté par le DG ; dossiers administratifs et priorités", () => {
  ko(saveEvaluation(db, ctx(VET), { userId: ASST, period: "Nov", scores: { qualite: 4 }, strengths: "", improvements: "", comment: "" }), "DG seulement", "DG");
  ko(saveEvaluation(db, ctx(DG), { userId: ASST, period: "Nov", scores: { qualite: 7 }, strengths: "", improvements: "", comment: "" }), "note bornée", "1 à 5");
  ok(saveEvaluation(db, ctx(DG), { userId: ASST, period: "Nov", scores: { qualite: 4, ponctualite: 5 }, strengths: "", improvements: "", comment: "" }), "évaluation");
  ko(saveAdminFile(db, ctx(DG), { name: "Patente", category: "Licences", year: "2026", openedAt: today, periodicity: "Annuelle", responsible: "DG", status: "en_cours", driveUrl: "drive" }), "lien invalide", "invalide");
  const id = ok(saveAdminFile(db, ctx(DG), { name: "Patente", category: "Licences", year: "2026", openedAt: today, dueDate: today, periodicity: "Annuelle", responsible: "DG", status: "en_cours", driveUrl: "https://drive.google.com/drive/folders/abc" }), "dossier")!;
  check(priorityOf(db.adminFiles!.find((f) => f.id === id)!, today) === "urgent", "échéance du jour = urgent");
});

test("Marges : vente comptoir comptée en pharmacie au coût d'achat ; contact du client de passage gardé", () => {
  const before = margins(db, periodOf("jour", today));
  const prod = db.products.find((p) => p.salePrice > p.purchasePrice && p.purchasePrice > 0 && productStock(db, p.id, "est-abj", today) >= 1)!;
  const cash = db.accounts.find((a) => a.type === "caisse" && a.establishmentId === "est-abj")!;
  ok(counterSale(db, ctx(ACC), { lines: [{ productId: prod.id, qty: 1, unitPrice: prod.salePrice, discountPct: 0 }], payment: { method: "especes", accountId: cash.id, amount: prod.salePrice }, walkIn: { name: "Mme Passage", phone: "0102030405" }, opKey: "t-marge" }), "vente de passage");
  check(db.invoices[0].saleInfo?.contact?.phone === "0102030405" && db.invoices[0].payerName === "Mme Passage", "contact enregistré");
  const after = margins(db, periodOf("jour", today));
  check(after.buckets.pharmacie.revenue - before.buckets.pharmacie.revenue === prod.salePrice, "CA pharmacie +prix de vente");
  check(after.buckets.pharmacie.cost - before.buckets.pharmacie.cost === prod.purchasePrice, "coût = prix d'achat");
  const y = periodOf("veille", today);
  check(y.from === y.to && y.from < today, "veille = hier");
  check(periodOf("annee", today).from === `${today.slice(0, 4)}-01-01`, "année civile");
});

test("Enregistrement rapide : client et patient minimaux, marqués à compléter puis complétés", () => {
  const dup = db.clients.find((c) => !c.isWalkIn && c.phone)!;
  ko(quickRegister(db, ctx(ACC), { client: { name: "X", phone: dup.phone }, patient: { name: "Rex", species: "Chien" } }), "doublon de téléphone", "déjà");
  const r = ok(quickRegister(db, ctx(ACC), { client: { name: "M. Rapide", phone: "0708091011" }, patient: { name: "Rex", species: "Chien", ageYears: 2 } }), "enregistrement")!;
  const p = db.patients.find((x) => x.id === r.patientId)!;
  check(!!p.incomplete && !!db.clients.find((c) => c.id === r.clientId)!.incomplete && p.ownerId === r.clientId, "fiches à compléter");
  ok(updatePatient(db, ctx(VET), { id: p.id, patch: { breed: "Berger" } }), "complété");
  check(!db.patients.find((x) => x.id === p.id)!.incomplete, "fiche patient complète");
});

test("Consultation à domicile : départ puis arrivée tracés ; refus sur un RDV classique", () => {
  const home = db.appointments.find((a) => a.home);
  check(!!home, "une visite à domicile de démonstration");
  ok(markHomeVisit(db, ctx(VET), { id: home!.id, step: "depart" }), "départ");
  ok(markHomeVisit(db, ctx(VET), { id: home!.id, step: "arrivee" }), "arrivée");
  const h = db.appointments.find((a) => a.id === home!.id)!.home!;
  check(!!h.departedAt && !!h.arrivedAt, "heures notées");
  const plain = db.appointments.find((a) => !a.home)!;
  ko(markHomeVisit(db, ctx(VET), { id: plain.id, step: "depart" }), "RDV classique", "domicile");
});

test("Matériel : valeur d'achat totale, réformé exclu, suppression réservée au DG", () => {
  const t0 = equipmentTotals(db).total;
  ko(saveEquipment(db, ctx(ACC), { name: "", category: "Autre", quantity: 1, unitCost: 1000, condition: "bon" }), "nom requis", "requis");
  const id = ok(saveEquipment(db, ctx(ACC), { name: "Balance", category: "Autre", quantity: 2, unitCost: 50000, condition: "neuf" }), "ajout")!;
  check(equipmentTotals(db).total === t0 + 100000, "valeur = qté × prix");
  ok(saveEquipment(db, ctx(ACC), { ...db.equipment!.find((e) => e.id === id)!, condition: "reforme" }), "réformé");
  check(equipmentTotals(db).total === t0, "réformé hors total");
  ko(deleteEquipment(db, ctx(ACC), { id }), "DG seulement", "DG");
  ok(deleteEquipment(db, ctx(DG), { id }), "suppression DG");
});

test("Projets : dépense rattachée avec photo et lien Drive, preuves ajoutées après coup, projet terminé fermé", () => {
  ko(saveProject(db, ctx(DG), { name: "X", status: "en_cours", driveUrl: "drive" }), "lien Drive invalide", "invalide");
  const pid = ok(saveProject(db, ctx(DG), { name: "Clôture du chenil", status: "en_cours", budget: 100000 }), "projet")!;
  const acc = [...db.accounts].sort((a, b) => accountBalance(db, b.id) - accountBalance(db, a.id))[0];
  const cat = db.settings.expenseCategories[0];
  ko(createExpense(db, ctx(ACC), { accountId: acc.id, category: cat, label: "Grillage", amount: 30000, date: today, projectId: pid, proofLinks: [{ label: "Facture", url: "pas un lien" }] }), "lien refusé", "invalide");
  ok(createExpense(db, ctx(ACC), { accountId: acc.id, category: cat, label: "Grillage", amount: 30000, date: today, projectId: pid, proofLinks: [{ label: "Facture", url: "https://drive.google.com/file/d/abc/view" }], photos: [{ name: "recu.jpg", dataUrl: "data:image/jpeg;base64,AAAA" }] }), "dépense du projet");
  const e = db.expenses[0];
  check(e.projectId === pid && proofCount(e) === 2, "projet et 2 preuves");
  const s = projectSpend(db, db.projects!.find((p) => p.id === pid)!);
  check(s.spent + s.pending === 30000 && s.left === 70000, "consommation du projet");
  const bare = db.expenses.find((x) => proofCount(x) === 0 && x.id !== e.id)!;
  ok(addExpenseProof(db, ctx(ACC), { id: bare.id, photo: { name: "facture.jpg", dataUrl: "data:image/jpeg;base64,BBBB" } }), "photo ajoutée après coup");
  ko(addExpenseProof(db, ctx(ACC), { id: bare.id, photo: { name: "x.pdf", dataUrl: "data:application/pdf;base64,CC" } }), "pdf refusé en photo", "image");
  ok(setExpenseProject(db, ctx(ACC), { id: bare.id, projectId: pid }), "rattachement après coup");
  const ph = db.expenses.find((x) => x.id === bare.id)!.photos![0];
  if (db.expenses.find((x) => x.id === bare.id)!.status === "approuvee") ko(removeExpenseProof(db, ctx(ACC), { id: bare.id, proofId: ph.id }), "retrait réservé au DG", "DG");
  ok(removeExpenseProof(db, ctx(DG), { id: bare.id, proofId: ph.id }), "retrait DG");
  ok(saveProject(db, ctx(DG), { id: pid, name: "Clôture du chenil", status: "termine", budget: 100000 }), "projet terminé");
  ko(setExpenseProject(db, ctx(ACC), { id: bare.id, projectId: pid }), "projet terminé fermé", "terminé");
});

test("RDV pris par l'accueil pour le DG : demande, conflit non bloquant, décision du DG seulement", () => {
  const cli = db.clients.find((c) => !c.isWalkIn)!;
  const est = db.establishments[0].id;
  const base = { establishmentId: est, clientId: cli.id, practitionerId: DG, durationMin: 30, reason: "Test demande", resource: "", reminder: { enabled: false, channel: "sms" as const, offsetHours: 2 } };
  const id = ok(createAppointment(db, ctx(ACC), { input: { ...base, start: `${today.slice(0, 8)}28T09:00` }, note: "Le client préfère le matin" }), "demande")!;
  const a = db.appointments.find((x) => x.id === id)!;
  check(a.status === "demande" && a.request?.requestedById === ACC, "statut demande");
  check(db.notifications.some((n) => n.toUserIds?.includes(DG) && /demande/i.test(n.title)), "DG notifié");
  ko(decideAppointmentRequest(db, ctx(VET), { id, decision: "accepte" }), "autre praticien refusé", "praticien");
  ko(decideAppointmentRequest(db, ctx(DG), { id, decision: "refuse" }), "motif requis", "motif");
  ok(decideAppointmentRequest(db, ctx(DG), { id, decision: "deplace", newStart: `${today.slice(0, 8)}28T11:00`, force: true }), "déplacé");
  const b = db.appointments.find((x) => x.id === id)!;
  check(b.status === "planifie" && b.start.endsWith("11:00") && !!b.request?.originalStart?.endsWith("09:00"), "accepté à 11 h");
  ko(decideAppointmentRequest(db, ctx(DG), { id, decision: "accepte" }), "déjà traité", "déjà");
  const own = ok(createAppointment(db, ctx(DG), { input: { ...base, start: `${today.slice(0, 8)}28T15:00` }, force: true }), "RDV du DG")!;
  check(db.appointments.find((x) => x.id === own)!.status === "planifie", "le DG n'a pas à valider ses propres RDV");
});

test("Catégories de produits : ajout, suppression avec transfert des produits", () => {
  const s0 = db.settings;
  const input = { labels: { ...(s0.categoryLabels ?? {}), hygiene: "Hygiène" }, details: s0.categoryDetails ?? {}, expenseCategories: s0.expenseCategories, expenseDetails: s0.expenseDetails ?? {} };
  const n = db.products.filter((p) => p.category === "materiel").length;
  const list = [...s0.productCategories.filter((c) => c !== "materiel"), "hygiene"];
  if (n) ko(saveCats(db, ctx(DG), { ...input, productCategories: list }), "transfert obligatoire", "déplacer");
  ko(saveCats(db, ctx(ACC), { ...input, productCategories: list, reassign: { materiel: "hygiene" } }), "DG seulement", "DG");
  ok(saveCats(db, ctx(DG), { ...input, productCategories: list, reassign: { materiel: "hygiene" } }), "catégories");
  check(db.settings.productCategories.includes("hygiene") && !db.settings.productCategories.includes("materiel"), "liste à jour");
  check(db.products.filter((p) => p.category === "hygiene").length === n && !db.products.some((p) => p.category === "materiel"), "produits déplacés");
});

test("Recettes par famille : total cohérent, source reconnue, famille vide = non classé", () => {
  const p = { from: `${today.slice(0, 4)}-01-01`, to: today };
  const r = revenueByFamily(db, p);
  check(Math.abs(r.rows.reduce((s, x) => s + x.revenue, 0) - r.total) < 1, "somme des familles = total");
  const inv = db.invoices.find((i) => i.lines.some((l) => /vaccination/i.test(l.label)))!;
  check(sourceOf(db, inv, inv.lines.find((l) => /vaccination/i.test(l.label))!) === "svc:vaccination", "acte de vaccination reconnu");
  ok(saveRevenueFamilies(db, ctx(DG), { families: DEFAULT_FAMILIES.filter((f) => f.id !== "fam-consult") }), "famille retirée");
  const r2 = revenueByFamily(db, p);
  check((r2.rows.find((x) => x.id === UNCLASSIFIED)?.revenue ?? 0) > 0, "consultations non classées");
  check(insights(r2.rows).some((i) => /non class/i.test(i.title)), "piste : classer");
  ko(saveRevenueFamilies(db, ctx(ACC), { families: DEFAULT_FAMILIES }), "DG seulement", "DG");
});

test("Tutoriels : lien vidéo par le DG, « vu » par chacun", () => {
  ko(setTutorialVideo(db, ctx(DG), { id: "tuto-vente", url: "youtube" }), "lien invalide", "invalide");
  ko(setTutorialVideo(db, ctx(ACC), { id: "tuto-vente", url: "https://youtu.be/abcdefgh" }), "DG seulement", "DG");
  ok(setTutorialVideo(db, ctx(DG), { id: "tuto-vente", url: "https://youtu.be/abcdefgh" }), "lien");
  ok(markTutorialSeen(db, ctx(ACC), { id: "tuto-vente", seen: true }), "vu");
  const t = db.tutorials!.find((x) => x.id === "tuto-vente")!;
  check(t.videoUrl === "https://youtu.be/abcdefgh" && !!t.seenBy?.includes(ACC), "enregistré");
});

test("Plateforme : cloison éditeur / clinique, licence + maintenance, pubs ciblées toujours affichées", () => {
  const ED = "u-editeur";
  check(canRole2("editeur", "plateforme") && !canRole2("editeur", "patients") && !canRole2("editeur", "finances"), "l'éditeur ne voit que la console");
  check(!canRole2("dg", "plateforme"), "le DG d'une clinique ne voit pas la console");
  const c = db.platform!.clinics.find((x) => x.status === "prospect")!;
  ko(recordPlatformPayment(db, ctx(DG), { clinicId: c.id, kind: "licence", amount: 1000000, date: today }), "DG refusé", "éditeur");
  ok(recordPlatformPayment(db, ctx(ED), { clinicId: c.id, kind: "licence", amount: 1500000, date: today }), "acompte licence");
  const c2 = db.platform!.clinics.find((x) => x.id === c.id)!;
  check(c2.status === "actif" && !!c2.paidUntil, "vendue : active et première maintenance ouverte");
  const before = c2.paidUntil!;
  ok(recordPlatformPayment(db, ctx(ED), { clinicId: c.id, kind: "maintenance", amount: c2.maintenanceAmount * 3, date: today, periods: 3 }), "3 mois de maintenance");
  check(db.platform!.clinics.find((x) => x.id === c.id)!.paidUntil! > before, "couverture prolongée");
  ko(setClinicStatus(db, ctx(ED), { id: c.id, status: "suspendu" }), "motif obligatoire", "motif");
  const id = ok(saveCampaign(db, ctx(ED), { title: "Test pub", sponsor: "Labo", text: "", placements: ["dashboard"], active: true, target: { countries: ["Côte d'Ivoire"], languages: [], clienteles: [], clinicIds: [] } }), "campagne")!;
  const me = selfClinic(db)!;
  check(targets(db.platform!.campaigns.find((x) => x.id === id)!, me), "la clinique de la démo est ciblée");
  const list = liveAnnouncements(db, "dashboard", today);
  check(list[0]?.platform === true && list.some((a) => a.id === `cmp:${id}`), "pub Cliva en tête de rotation");
  ok(trackAnnouncement(db, ctx(ACC), { id: `cmp:${id}`, kind: "view" }), "vue comptée");
  check(db.platform!.campaigns.find((x) => x.id === id)!.stats[me.id]?.views === 1, "vue attribuée à la clinique");
  const late = db.platform!.clinics.find((x) => x.id === "clin-acc")!;
  check(maintenanceState(late, today, db.platform!.offer.graceDays).state === "en_retard", "maintenance en retard détectée");
});

test("Rente : animal identifié pris en charge, étendu au cheptel, nouvelles et rapport de visite", () => {
  const f = db.farms.find((x) => x.status === "actif" && x.lots.some((l) => l.status === "actif"))!;
  const lot = f.lots.find((l) => l.status === "actif")!;
  const base = { farmId: f.id, species: "Ovin", count: 1, date: today, vetId: VET, complaint: "Boiterie", exam: { temperature: 40.1, findings: "Abcès du pied" }, diagnosis: "Piétin", treatments: [{ product: "Oxytétracycline", dose: "1 mL/10 kg", route: "IM", count: 1 }], advice: "Isoler", addToVisit: true };
  ko(openCareCase(db, ctx(VET), { ...base, scope: "animal", reason: "appel" }), "animal requis", "animal");
  const visits = f.visits.length;
  const id = ok(openCareCase(db, ctx(VET), { ...base, scope: "animal", reason: "appel", newAnimal: { tag: "OV-999", species: "Ovin", sex: "femelle" }, nextCheckDays: 2 }), "prise en charge animal")!;
  const f2 = db.farms.find((x) => x.id === f.id)!;
  check(!!f2.animals?.some((a) => a.tag === "OV-999"), "animal identifié");
  check(f2.visits.length >= visits && f2.visits.some((v) => v.report.includes("Piétin")), "consigné au rapport de visite");
  check(f2.interventions!.some((x) => x.problem === "Piétin"), "intervention tracée");
  ko(openCareCase(db, ctx(VET), { ...base, scope: "animal", reason: "appel", newAnimal: { tag: "OV-999", species: "Ovin" } }), "boucle en double", "existe");
  const herd = ok(openCareCase(db, ctx(VET), { ...base, scope: "lot", lotId: lot.id, reason: "pathologie", count: 30, parentId: id }), "extension au cheptel")!;
  check(db.careCases!.find((c) => c.id === herd)!.parentId === id && db.careCases!.find((c) => c.id === id)!.followUps.some((u) => /étendue/.test(u.note)), "lien animal → cheptel");
  ko(logCareFollowUp(db, ctx(ACC), { caseId: herd, channel: "appel", state: "stable", note: "" }), "note obligatoire", "éleveur");
  ok(logCareFollowUp(db, ctx(ACC), { caseId: herd, channel: "appel", state: "aggravation", sick: 5, dead: 1, note: "5 malades, 1 mort", nextCheckDays: 1 }), "nouvelles");
  check(!careDue(db.careCases!.find((c) => c.id === herd)!, today), "prochain rappel décalé");
  ok(logCareFollowUp(db, ctx(VET), { caseId: id, channel: "visite", state: "gueri", note: "Marche normalement" }), "guérison");
  check(db.careCases!.find((c) => c.id === id)!.status === "gueri", "clôturé guéri");
});

test("Tâches d'équipe : document sans lien Drive refusé, vérification par le DG", () => {
  const id = ok(assignTeamTask(db, ctx(DG), { title: "Fiche conseils", description: "", assigneeId: ASST, priority: "normale", dueDate: today, category: "document" }), "tâche confiée")!;
  check(db.notifications.some((n) => n.toUserIds?.includes(ASST) && /Document/.test(n.title)), "notification");
  ko(completeTeamTask(db, ctx(ACC), { id, note: "", driveUrl: "https://drive.google.com/x" }), "pas la bonne personne", "personne");
  ko(completeTeamTask(db, ctx(ASST), { id, note: "fait" }), "lien obligatoire", "Drive");
  ok(completeTeamTask(db, ctx(ASST), { id, note: "fait", driveUrl: "https://drive.google.com/file/d/abc/view" }), "faite");
  check(db.tasks.find((t) => t.id === id)!.review?.status === "a_verifier", "à vérifier");
  ko(reviewTeamTask(db, ctx(DG), { id, ok: false }), "motif de reprise", "reprendre");
  ok(reviewTeamTask(db, ctx(DG), { id, ok: false, note: "Ajouter le logo" }), "à reprendre");
  check(db.tasks.find((t) => t.id === id)!.status === "en_cours", "rouverte");
});

test("Caisses de suivi : prestation affectée une seule fois, entrée manuelle, total", () => {
  const bid = ok(saveCashBox(db, ctx(DG), { name: "Chirurgie test", color: "purple", active: true }), "caisse")!;
  ko(saveCashBox(db, ctx(ACC), { name: "X", color: "brand", active: true }), "DG seulement", "réservée");
  const inv = db.invoices.find((i) => i.kind === "facture" && i.status === "validee" && i.lines.length)!;
  const l = inv.lines.find((x) => !(db.cashBoxes ?? []).some((b) => b.entries.some((e) => e.lineId === x.id)))!;
  ok(assignToCashBox(db, ctx(ACC), { boxId: bid, lines: [{ invoiceId: inv.id, lineId: l.id }] }), "affectation");
  const other = ok(saveCashBox(db, ctx(DG), { name: "Autre test", color: "brand", active: true }), "2e caisse")!;
  ko(assignToCashBox(db, ctx(ACC), { boxId: other, lines: [{ invoiceId: inv.id, lineId: l.id }] }), "déjà affectée", "déjà");
  ok(addCashBoxEntry(db, ctx(ACC), { boxId: bid, label: "Don", amount: 10000, date: today }), "entrée");
  const b = db.cashBoxes!.find((x) => x.id === bid)!;
  check(boxTotal(b) === lineTotal(l) + 10000, "total de la caisse");
});

test("Constantes : repères signalés", () => {
  check(vitalAlerts({ temperature: 40, crtSec: 3, painScore: 6 }).length === 3, "trois alertes");
  check(vitalAlerts({ temperature: 38.5 }).length === 0, "normal");
});

test("Prophylaxie : modèle appliqué à une bande, dates calculées, report, historique", () => {
  check((db.prophylaxisPrograms ?? []).length >= 7 && (db.prophylaxisPlans ?? []).length >= 2, "modèles et exemples présents");
  const pg = db.prophylaxisPrograms!.find((p) => p.id === "pgm-chair")!;
  const f = db.farms.find((x) => x.lots.some((l) => l.status === "actif"))!;
  const lot = f.lots.find((l) => l.status === "actif")!;
  const start = addDays(today, -10);
  ko(saveProphylaxisProgram(db, ctx(ACC), { name: "X", species: "Volaille", startLabel: "J1", steps: [{ id: "", day: 1, kind: "vitamines", label: "Test" }] }), "accueil ne modifie pas les modèles");
  const pid = ok(assignProphylaxis(db, ctx(VET), { programId: pg.id, target: "lot", farmId: f.id, lotId: lot.id, count: 500, startDate: start, pastDone: true }), "appliquer")!;
  const plan = db.prophylaxisPlans!.find((p) => p.id === pid)!;
  check(plan.steps.length === pg.steps.length, "toutes les actions copiées");
  check(plan.steps[0].dueDate === start, "J1 = date de départ");
  check(plan.steps.find((s) => s.day === 5)!.dueDate === addDays(start, 4), "J5 = départ + 4 jours");
  check(plan.steps.filter((s) => s.dueDate < today).every((s) => s.status === "fait"), "actions passées notées faites");
  const nextStep = plan.steps.find((s) => s.status === "a_faire")!;
  const after = plan.steps.filter((s) => s.status === "a_faire" && s.id !== nextStep.id).map((s) => s.dueDate);
  ok(editProphyStep(db, ctx(VET), { planId: pid, stepId: nextStep.id, dueDate: addDays(nextStep.dueDate, 3), shiftFollowing: true }), "report");
  const p2 = db.prophylaxisPlans!.find((p) => p.id === pid)!;
  check(p2.steps.filter((s) => s.status === "a_faire" && s.id !== nextStep.id).map((s) => s.dueDate).every((d, i) => d === addDays(after[i], 3)), "suivantes décalées de 3 jours");
  const n0 = (f.interventions ?? []).length;
  ko(markProphyStepDone(db, ctx(VET), { planId: pid, stepId: nextStep.id, date: addDays(today, 2) }), "pas de date future", "futur");
  ok(markProphyStepDone(db, ctx(VET), { planId: pid, stepId: nextStep.id, date: today, lotRef: "L123" }), "fait");
  check((db.farms.find((x) => x.id === f.id)!.interventions ?? []).length === n0 + 1, "intervention ajoutée à l'exploitation");
  ok(undoProphyStep(db, ctx(VET), { planId: pid, stepId: nextStep.id }), "annuler la saisie");
  check((db.farms.find((x) => x.id === f.id)!.interventions ?? []).length === n0, "intervention retirée");
  check(dueActions(db, today, 365).some((a) => a.plan.id === pid), "visible dans « À faire »");
});

test("Prophylaxie : chiot, vaccination reportée dans le carnet", () => {
  const pt = db.patients.find((p) => p.species === "Chien" && p.vitalStatus === "vivant")!;
  const pid = ok(assignProphylaxis(db, ctx(VET), { programId: "pgm-chiot", target: "patient", patientId: pt.id, startDate: addDays(today, -50) }), "appliquer au chiot")!;
  const plan = db.prophylaxisPlans!.find((p) => p.id === pid)!;
  const vac = plan.steps.find((s) => s.kind === "vaccination")!;
  const n0 = db.patients.find((p) => p.id === pt.id)!.vaccinations.length;
  ok(markProphyStepDone(db, ctx(VET), { planId: pid, stepId: vac.id, date: today }), "vaccin fait");
  const v = db.patients.find((p) => p.id === pt.id)!.vaccinations;
  check(v.length === n0 + 1 && !!v[0].nextDue, "vaccination au carnet avec prochain rappel");
});

test("Index thérapeutique : en-tête repéré, cellules fusionnées, import remplacé, droits", () => {
  const rows = parseCsv("INDEX TEST\nSource : document interne\n\nMolécule;Indications;Posologie;Voie;AMM\nAlphamol;Douleur;1 mg/kg BID;IV;Vétérinaire\n;Fièvre;2 mg/kg SID;PO;Vétérinaire\nBétamol;Sédation;0,5 mg/kg;IM;Humaine\n;;;;\n");
  const p = rowsToEntries(rows, "Cheval")!;
  check(p.headerRow === 3 && p.entries.length === 3, "3 lignes après l'en-tête");
  check(p.entries[1].molecule === "Alphamol" && p.entries[1].species === "Cheval", "molécule reprise sur la ligne fusionnée");
  ko(importDrugIndex(db, ctx(ACC), { name: "Test", species: "Cheval", rows: p.entries }), "accueil refusé");
  const sid = ok(importDrugIndex(db, ctx(VET), { name: "Index test", species: "Cheval", rows: p.entries }), "import")!;
  check(db.drugIndex!.entries.filter((e) => e.sourceId === sid).length === 3, "3 lignes importées");
  ok(importDrugIndex(db, ctx(VET), { name: "Index test", species: "Cheval", rows: p.entries.slice(0, 2), replace: true }), "réimport");
  check(db.drugIndex!.entries.filter((e) => e.sourceId === sid).length === 2 && db.drugIndex!.sources.filter((s) => s.name === "Index test").length === 1, "remplacé, pas dupliqué");
  check(entriesForMolecule(db, "Alphamol").length === 2, "visible depuis la fiche molécule");
  ko(saveDrugIndexEntry(db, ctx(VET), { species: "Cheval", molecule: "Gamma" }), "posologie ou indication requise");
  ko(removeDrugIndexSource(db, ctx(VET), { id: sid }), "retrait réservé au DG");
  ok(removeDrugIndexSource(db, ctx(DG), { id: sid }), "retrait");
  check(!db.drugIndex!.entries.some((e) => e.sourceId === sid), "lignes retirées");
});

test("Calculateur : posologie de l'index lue, produit IV à adapter (flacon, voie, composants)", () => {
  const d1 = parseDosage("10 000-50 000 UI/kg QID")!;
  check(d1.min === 10000 && d1.max === 50000 && d1.unit === "UI/kg" && d1.perDay === 4, "UI/kg QID");
  const d2 = parseDosage("1,1 mg/kg SID")!;
  check(d2.min === 1.1 && d2.max === 1.1 && d2.perDay === 1, "1,1 mg/kg SID");
  check(parseDosage("2 gouttes q4-6 h") === null, "pas de dose par kilo");
  check(routeMismatch("PO", ["IV"]) && !routeMismatch("IV, IM", ["IV"]), "voies");
  const p = db.products.find((x) => x.id === "prd-h02")!;
  check(!!p?.vial && p.routes?.[0] === "IV", "exemple de spécialité humaine IV présent");
  check(Math.abs(vialConc(p.vial!, "") - 60) < 1e-9 && Math.abs(vialConc(p.vial!, "Amoxicilline") - 50) < 1e-9, "concentration du flacon");
  const mol = baseMolecules().find((m) => m.id === "amoxicilline-acide-clavulanique")!;
  check(!!mol, "molécule association trouvée");
  const poso = mol.posologies.find((x) => x.species === "ch")!;
  const r = compute({ molecule: mol, posology: poso, species: "ch", kg: 10, dose: 20, conc: 60, concUnit: "mg/mL", humanProduct: true, productInfo: { routes: ["IV"], vial: { volumeMl: 20, basisMg: 1200 }, components: p.vial!.components.map((c) => ({ name: c.name, mgPerMl: c.mg / 20 })) } })!;
  check(Math.abs(r.volumeMl - 200 / 60) < 1e-9, "200 mg = 3,33 mL");
  check(r.alerts.some((a) => /s'administre en IV/.test(a.text)), "alerte de voie");
  check(r.rows.some(([k]) => k === "Part du flacon") && r.rows.some(([k]) => /acide clavulanique/i.test(k)), "part du flacon et apport par composant");
});

test("Ordonnance de plusieurs médicaments : un numéro, validation groupée, ordonnance après vente sans double sortie", () => {
  const pt = db.patients.find((p) => p.species === "Chien" && p.vitalStatus === "vivant")!;
  const [a, b] = db.products.filter((p) => p.status === "actif" && p.category === "medicament");
  const line = (productId: string, dose: string) => ({ productId, form: "", route: "PO", quantity: 1, dose, frequency: "2 fois par jour", duration: "7 jours", instructions: "" });
  ko(createPrescriptionOrder(db, ctx(VET), { patientId: pt.id, vetId: VET, lines: [line(a.id, "1 cp"), line(b.id, "")] }), "dose manquante refusée", "dose");
  ko(createPrescriptionOrder(db, ctx(ACC), { patientId: pt.id, vetId: VET, lines: [line(a.id, "1 cp")] }), "accueil ne prescrit pas");
  const oid = ok(createPrescriptionOrder(db, ctx(VET), { patientId: pt.id, vetId: VET, lines: [line(a.id, "1 cp"), line(b.id, "2 mL")], note: "Revoir dans 7 jours" }), "ordonnance 2 médicaments")!;
  const rows = db.prescriptions.filter((p) => p.orderId === oid);
  check(rows.length === 2 && rows[0].orderCode === rows[1].orderCode && rows.every((r) => r.status === "brouillon"), "2 lignes, même numéro, brouillon");
  check(orderLines(db, rows[0]).length === 2 && rows.every((r) => r.orderNote === "Revoir dans 7 jours"), "regroupées avec la consigne");
  ok(validatePrescriptionOrder(db, ctx(VET), { orderId: oid }), "validation groupée");
  check(db.prescriptions.filter((p) => p.orderId === oid).every((r) => r.status === "validee"), "toutes validées");
  const mv0 = db.movements.length;
  const sid = ok(createPrescriptionOrder(db, ctx(VET), { patientId: pt.id, vetId: VET, lines: [line(a.id, "1 cp")], sale: { invoiceId: "inv-test" } }), "après vente")!;
  const s1 = db.prescriptions.find((p) => p.orderId === sid)!;
  check(s1.status === "delivree" && db.movements.length === mv0, "déjà remis, aucun nouveau mouvement de stock");
});

console.log(`\n${passed} test(s) réussi(s), ${failed} échec(s).\n`);
if (failed) process.exit(1);
