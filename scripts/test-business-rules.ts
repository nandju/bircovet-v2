/**
 * Tests des règles métier de la simulation (services purs, sans navigateur).
 * Lancer : npm run test:rules
 */
import { accountBalance, docTotal, invoiceBalance, productStock } from "../src/lib/calc";
import { isoLocal } from "../src/lib/format";
import { createSeed } from "../src/lib/seed";
import { createClient, findDuplicates, mergeClients } from "../src/lib/services/clientsService";
import { createPatient, transferOwnership, declareDeath, addPatientNote } from "../src/lib/services/patientsService";
import { createAppointment, findConflicts, setQueueStatus } from "../src/lib/services/appointmentsService";
import { createConsultation, submitConsultation, validateConsultation, recordEuthanasia, updateConsultation } from "../src/lib/services/consultationsService";
import { createPrescription, deliverPrescription, validatePrescription, remaining } from "../src/lib/services/prescriptionsService";
import { createReception, validateReception, setPOStatus } from "../src/lib/services/suppliersService";
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
import type { ActionCtx, DemoDB, ServiceResult } from "../src/lib/types";

let db: DemoDB = createSeed(new Date());
const now = isoLocal(new Date());
const today = now.slice(0, 10);
db = refreshDerived(db, today);
let passed = 0;
let failed = 0;

const ctx = (userId: string, offline = false): ActionCtx => ({ user: db.users.find((u) => u.id === userId)!, establishmentId: "est-abj", offline, now });
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
  const mid = ok(createMission(db, ctx(VET), { objective: "Test", date: today, endDate: today, location: "x", leaderId: VET, teamIds: [ASST], farmIds: ["farm-1"], clientIds: ["cli-023"], plannedInterventions: ["a"] }), "création")!;
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

console.log(`\n${passed} test(s) réussi(s), ${failed} échec(s).\n`);
if (failed) process.exit(1);
