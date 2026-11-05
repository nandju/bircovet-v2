/**
 * Vente au comptoir de la pharmacie : facture validée, sortie de stock FEFO,
 * encaissement, et collecte du profil éleveur (cheptel, effectifs, lieu de la ferme)
 * rattaché au dossier client unique.
 */
import { pickLotsFEFO } from "../calc";
import { phoneKey, WALK_IN_ID } from "../clientActivity";
import { addDays, uid } from "../format";
import type { Client, DemoDB, Farm, FarmType, PaymentMethod } from "../types";
import { audit, fail, must, nextCode, positive, produce, requireOnline, requireRole, today, type Service } from "./core";
import { applyMovement } from "./inventoryService";

export const HERD_SPECIES = ["Volaille", "Bovin", "Ovin", "Caprin", "Porcin", "Lapin", "Poisson", "Équidé"] as const;

export interface CounterSaleInput {
  /** Client existant, ou nouveau client, ou client de passage (aucun des deux). */
  clientId?: string;
  newClient?: { name: string; phone: string; city: string; referredBy?: string; acquisition?: string };
  /** Profil éleveur : effectifs par espèce et lieu de l'exploitation. */
  herd?: { species: string; count: number }[];
  farm?: { name?: string; location: string };
  lines: { productId: string; qty: number; unitPrice: number; discountPct: number }[];
  payment: { method: PaymentMethod; accountId: string; amount: number; reference?: string };
  species?: string;
  purpose?: string;
  /** Client de passage : coordonnées facultatives. */
  walkIn?: { name?: string; phone?: string };
  opKey: string;
}

function farmTypeOf(herd: { species: string; count: number }[]): FarmType {
  const s = herd.filter((h) => h.count > 0).map((h) => h.species);
  if (s.length > 1) return "mixte";
  return ({ Volaille: "avicole", Bovin: "bovin", Porcin: "porcin", Ovin: "ovin_caprin", Caprin: "ovin_caprin", Poisson: "piscicole" } as Record<string, FarmType>)[s[0]] ?? "mixte";
}

function ensureWalkIn(d: DemoDB, ctx: { establishmentId: string; now: string }): Client {
  let c = d.clients.find((x) => x.id === WALK_IN_ID);
  if (!c) {
    c = { id: WALK_IN_ID, code: "CLI-PASSAGE", type: "particulier", name: "Client de passage (comptoir)", phoneCode: "+225", phone: "", email: "", address: "", city: "", contacts: [], commPrefs: { sms: false, whatsapp: false, email: false, call: false }, segment: "standard", payerName: "", payerTaxId: "", notes: [], status: "actif", establishmentId: ctx.establishmentId, createdAt: ctx.now.slice(0, 10), lastActivityAt: ctx.now.slice(0, 10), isWalkIn: true };
    d.clients.push(c);
  }
  return c;
}

export const counterSale: Service<CounterSaleInput, { invoiceId: string; clientId: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg", "vet", "accueil", "assistant"], "vente au comptoir");
    requireOnline(ctx, "Vente au comptoir");
    const done = d.invoices.find((i) => i.channel === "comptoir" && i.notes.includes(`[${input.opKey}]`));
    if (done) return { message: "Vente déjà enregistrée.", data: { invoiceId: done.id, clientId: done.clientId } };
    if (!input.lines.length) fail("Ajoutez au moins un produit.");

    // 1. Client : existant, nouveau (sans doublon de téléphone) ou de passage.
    let client: Client;
    if (input.clientId) client = must(d.clients.find((c) => c.id === input.clientId), "Client introuvable.");
    else if (input.newClient) {
      const n = input.newClient;
      if (!n.name.trim()) fail("Nom du client requis.");
      if (!n.phone.trim()) fail("Téléphone requis pour suivre le client.");
      const dup = d.clients.find((c) => !c.isWalkIn && c.status === "actif" && phoneKey(c.phone) === phoneKey(n.phone));
      if (dup) fail(`Ce numéro appartient déjà à ${dup.name} (${dup.code}) : sélectionnez ce client au lieu d'en créer un nouveau.`);
      client = { id: uid("cli"), code: nextCode(d, "client", "CLI"), type: "particulier", name: n.name.trim(), phoneCode: "+225", phone: n.phone.trim(), email: "", address: n.city.trim(), city: n.city.trim(), contacts: [], commPrefs: { sms: true, whatsapp: true, email: false, call: true }, segment: input.herd?.some((h) => h.count > 0) ? "eleveur" : "standard", payerName: "", payerTaxId: "", notes: [], status: "actif", establishmentId: ctx.establishmentId, createdAt: today(ctx), lastActivityAt: today(ctx), referredBy: n.referredBy?.trim() || undefined, acquisition: n.acquisition || "Comptoir pharmacie" };
      d.clients.unshift(client);
      audit(d, ctx, { module: "Clients", action: "Création au comptoir", target: `${client.code} — ${client.name}` });
    } else client = ensureWalkIn(d, ctx);

    // 2. Profil éleveur → exploitation rattachée au client (créée ou mise à jour).
    const herd = (input.herd ?? []).filter((h) => h.count > 0);
    if (herd.length && !client.isWalkIn) {
      let farm = d.farms.find((f) => f.clientId === client.id);
      if (!farm) {
        const fid = uid("farm");
        farm = { id: fid, code: nextCode(d, "farm", "EXP"), name: input.farm?.name?.trim() || `Ferme de ${client.name}`, clientId: client.id, type: farmTypeOf(herd), location: input.farm?.location ?? client.city, region: "", gps: "", access: "", managerName: client.name, managerPhone: client.phone, contacts: [], status: "actif", buildings: [], lots: [], headcounts: [], movements: [], visits: [], createdAt: today(ctx) } as Farm;
        d.farms.unshift(farm);
        audit(d, ctx, { module: "Exploitations", action: "Création depuis le comptoir", target: `${farm.code} — ${farm.name}` });
      } else if (input.farm?.location && !farm.location) farm.location = input.farm.location;
      for (const h of herd) {
        let lot = farm.lots.find((l) => l.species === h.species && l.status === "actif");
        if (!lot) {
          lot = { id: uid("flot"), name: `Effectif ${h.species.toLowerCase()}`, species: h.species, startDate: today(ctx), status: "actif" };
          farm.lots.push(lot);
        }
        farm.headcounts.push({ id: uid("hc"), lotId: lot.id, date: today(ctx), count: h.count, authorId: ctx.user.id, source: "declaration" });
      }
      if (client.segment === "standard") client.segment = "eleveur";
    }

    // 3. Facture validée + sortie de stock FEFO (vente directe, pas de prescription).
    const invId = uid("inv");
    const code = nextCode(d, "invoice", d.settings.invoicePrefix);
    const lines = input.lines.map((l) => {
      const p = must(d.products.find((x) => x.id === l.productId), "Article introuvable.");
      positive(l.qty, `Quantité de ${p.name}`);
      if (l.unitPrice < 0) fail("Prix invalide.");
      if (l.discountPct < 0 || l.discountPct > 100) fail("Remise invalide.");
      if (l.discountPct > d.settings.discountDelegationPct && ctx.user.roleId !== "dg") fail(`Remise de ${l.discountPct} % hors délégation (${d.settings.discountDelegationPct} %) : validation DG requise.`);
      const pick = pickLotsFEFO(d, p.id, ctx.establishmentId, l.qty, today(ctx));
      if (!pick.ok) fail(`${p.name} : ${pick.error}`);
      for (const a of pick.allocations) applyMovement(d, ctx, { lotId: a.lotId, type: "delivrance", qty: -a.qty, ref: { kind: "facture", id: invId }, note: `Vente comptoir ${code}`, opKey: `${input.opKey}-${p.id}-${a.lotId}` });
      return { id: uid("il"), label: p.brandName ?? p.name, kind: "produit" as const, productId: p.id, qty: l.qty, unitPrice: l.unitPrice, discountPct: l.discountPct, source: { kind: "vente" as const, id: invId, label: "Comptoir" } };
    });
    const total = lines.reduce((s, l) => s + Math.round(l.qty * l.unitPrice * (1 - l.discountPct / 100)), 0);
    d.invoices.unshift({ id: invId, code, kind: "facture", channel: "comptoir", clientId: client.id, payerName: client.isWalkIn ? input.walkIn?.name?.trim() || "Client de passage" : client.payerName || client.name, establishmentId: ctx.establishmentId, date: today(ctx), dueDate: addDays(today(ctx), 0), lines, status: "validee", authorId: ctx.user.id, validatedById: ctx.user.id, validatedAt: ctx.now, creditNoteIds: [], fiscalStatus: "a_transmettre_backend", notes: `Vente comptoir [${input.opKey}]`, saleInfo: { species: input.species, purpose: input.purpose?.trim() || undefined, sellerId: ctx.user.id, contact: client.isWalkIn && (input.walkIn?.name?.trim() || input.walkIn?.phone?.trim()) ? { name: input.walkIn?.name?.trim() || undefined, phone: input.walkIn?.phone?.trim() || undefined } : undefined } });

    // 4. Encaissement (total ou partiel : le reste devient une créance du client).
    const paid = Math.min(input.payment.amount, total);
    if (paid > 0) {
      const acc = must(d.accounts.find((a) => a.id === input.payment.accountId), "Compte d'encaissement requis.");
      if (input.payment.method === "especes" && acc.type !== "caisse") fail("Un paiement en espèces doit être affecté à une caisse.");
      if (input.payment.method === "mobile_money" && acc.type !== "mobile_money") fail("Un paiement Mobile Money doit être affecté à un compte Mobile Money.");
      if (client.isWalkIn && paid < total) fail("Un client de passage règle la totalité : enregistrez son nom et son téléphone pour un crédit.");
      d.payments.unshift({ id: uid("pay"), code: nextCode(d, "payment", "DEMO-ENC"), date: today(ctx), clientId: client.id, amount: paid, method: input.payment.method, accountId: acc.id, kind: "reglement", allocations: [{ invoiceId: invId, amount: paid }], reference: input.payment.reference ?? "", userId: ctx.user.id, opKey: `${input.opKey}-pay`, note: `Vente comptoir ${code}` });
    } else if (client.isWalkIn) fail("Un client de passage règle la totalité au comptoir.");
    client.lastActivityAt = today(ctx);
    audit(d, ctx, { module: "Pharmacie", action: "Vente comptoir", target: `${code} — ${client.name}`, newValue: `${total} F (${paid} encaissés)` });
    return { message: `Vente ${code} enregistrée : ${total.toLocaleString("fr-FR")} F CFA${paid < total ? ` (reste dû ${(total - paid).toLocaleString("fr-FR")} F)` : ""}.`, data: { invoiceId: invId, clientId: client.id } };
  });
