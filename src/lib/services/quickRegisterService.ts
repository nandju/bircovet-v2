import { phoneKey } from "../clientActivity";
import { addDays, uid } from "../format";
import type { Client, Patient } from "../types";
import { audit, fail, must, nextCode, produce, type Service } from "./core";

export interface QuickInput {
  /** Client existant, ou nouveau client minimal. */
  clientId?: string;
  client?: { name: string; phone: string; city?: string; address?: string };
  patient: { name: string; species: string; sex?: Patient["sex"]; ageYears?: number; breed?: string };
}

/**
 * Enregistrement rapide d'un patient (et de son propriétaire si nouveau) :
 * le minimum pour consulter tout de suite, le reste se complète ensuite.
 */
export const quickRegister: Service<QuickInput, { clientId: string; patientId: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    if (!input.patient.name.trim()) fail("Nom de l'animal requis.");
    if (!input.patient.species) fail("Espèce requise.");
    let client: Client | undefined;
    const day = ctx.now.slice(0, 10);
    if (input.clientId) client = must(d.clients.find((c) => c.id === input.clientId), "Client introuvable.");
    else {
      const c = input.client;
      if (!c?.name.trim()) fail("Nom du propriétaire requis.");
      if (!c.phone.trim() || c.phone.replace(/\D/g, "").length < 8) fail("Téléphone du propriétaire requis (8 chiffres minimum).");
      const dup = d.clients.find((x) => !x.isWalkIn && phoneKey(x.phone) === phoneKey(c.phone));
      if (dup) fail(`Ce numéro appartient déjà à ${dup.name} : choisissez ce client.`);
      client = {
        id: uid("cli"), code: nextCode(d, "client", "CLI"), type: "particulier", name: c.name.trim(), phoneCode: "+225", phone: c.phone.trim(), email: "", address: c.address?.trim() ?? "", city: c.city?.trim() ?? "",
        contacts: [], commPrefs: { sms: true, whatsapp: true, email: false, call: true }, segment: "standard", payerName: c.name.trim(), payerTaxId: "", notes: [], status: "actif", establishmentId: ctx.establishmentId, createdAt: day, lastActivityAt: day, incomplete: true,
      } as Client;
      d.clients.unshift(client);
    }
    const birth = input.patient.ageYears && input.patient.ageYears > 0 ? addDays(day, -Math.round(input.patient.ageYears * 365)) : "";
    const pid = uid("pat");
    d.patients.unshift({
      id: pid, code: nextCode(d, "patient", "PAT"), name: input.patient.name.trim(), species: input.patient.species, breed: input.patient.breed?.trim() ?? "", sex: input.patient.sex ?? "inconnu", birthDate: birth, birthDateEstimated: !!birth, chip: "", passport: "", insurance: "", color: "",
      ownerId: client.id, ownerHistory: [{ clientId: client.id, from: day, reason: "Enregistrement rapide" }], allergies: [], alerts: [], vitalStatus: "vivant", vitals: [], vaccinations: [], notes: [], photos: [], exams: [], archived: false, createdAt: day, incomplete: true,
    } as Patient);
    audit(d, ctx, { module: "Patients", action: "Enregistrement rapide", target: `${input.patient.name} — ${client.name}` });
    return { message: `${input.patient.name} enregistré${input.clientId ? "" : ` avec ${client.name}`} : complétez les fiches plus tard.`, data: { clientId: client.id, patientId: pid } };
  });
