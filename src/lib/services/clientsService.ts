import { normalize, uid } from "../format";
import type { Client, DemoDB } from "../types";
import { audit, fail, must, nextCode, produce, requireOnline, type Service } from "./core";
import { queueIfOffline } from "./syncService";

export type ClientInput = Omit<Client, "id" | "code" | "notes" | "status" | "createdAt" | "lastActivityAt" | "establishmentId"> & {
  establishmentId?: string;
};

function validate(input: ClientInput) {
  if (!input.name.trim()) fail("Le nom ou la raison sociale est obligatoire.");
  if (!/^[0-9 ]{8,}$/.test(input.phone.trim())) fail("Téléphone invalide (au moins 8 chiffres).");
  if (input.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email)) fail("Adresse e-mail invalide.");
}

export const createClient: Service<ClientInput, string> = (db, ctx, input) =>
  produce(db, (d) => {
    validate(input);
    const id = uid("cli");
    const code = nextCode(d, "client", "CLI");
    d.clients.unshift({
      ...input,
      id,
      code,
      notes: [],
      status: "actif",
      establishmentId: input.establishmentId ?? ctx.establishmentId,
      createdAt: ctx.now.slice(0, 10),
      lastActivityAt: ctx.now.slice(0, 10),
    });
    audit(d, ctx, { module: "Clients", action: "Création", target: `${code} — ${input.name}` });
    return { message: `Client ${code} créé.`, data: id };
  });

export const updateClient: Service<{ id: string; patch: Partial<ClientInput> }> = (db, ctx, { id, patch }) =>
  produce(db, (d) => {
    const c = must(d.clients.find((x) => x.id === id), "Client introuvable.");
    const before = { name: c.name, phone: c.phone, email: c.email, segment: c.segment };
    Object.assign(c, patch);
    validate(c);
    c.lastActivityAt = ctx.now.slice(0, 10);
    audit(d, ctx, {
      module: "Clients",
      action: "Modification",
      target: `${c.code} — ${c.name}`,
      oldValue: JSON.stringify(before),
      newValue: JSON.stringify({ name: c.name, phone: c.phone, email: c.email, segment: c.segment }),
    });
    return { message: "Fiche client enregistrée." };
  });

export const setClientArchived: Service<{ id: string; archived: boolean; reason: string }> = (db, ctx, { id, archived, reason }) =>
  produce(db, (d) => {
    const c = must(d.clients.find((x) => x.id === id));
    if (archived && !reason.trim()) fail("Un motif d'archivage est requis.");
    c.status = archived ? "archive" : "actif";
    audit(d, ctx, { module: "Clients", action: archived ? "Archivage (suppression logique)" : "Restauration", target: `${c.code} — ${c.name}`, reason });
    return { message: archived ? "Client archivé (suppression logique)." : "Client restauré." };
  });

export const addClientNote: Service<{ id: string; text: string }> = (db, ctx, { id, text }) =>
  produce(db, (d) => {
    if (!text.trim()) fail("La note est vide.");
    const c = must(d.clients.find((x) => x.id === id));
    const noteId = uid("note");
    c.notes.unshift({ id: noteId, text, authorId: ctx.user.id, date: ctx.now, syncStatus: ctx.offline ? "en_attente" : "synchronise" });
    queueIfOffline(d, ctx, "note_client", { kind: "client", id }, text, `Note client ${c.code}`, noteId);
    return { message: ctx.offline ? "Note enregistrée localement — en attente de synchronisation." : "Note ajoutée." };
  });

/** Fusion supervisée : le client secondaire est archivé, ses éléments rattachés au principal. */
export const mergeClients: Service<{ primaryId: string; secondaryId: string; reason: string }> = (db, ctx, { primaryId, secondaryId, reason }) =>
  produce(db, (d) => {
    requireOnline(ctx, "Fusion de clients");
    if (primaryId === secondaryId) fail("Sélectionnez deux clients différents.");
    if (!reason.trim()) fail("Le motif de fusion est obligatoire.");
    const a = must(d.clients.find((x) => x.id === primaryId));
    const b = must(d.clients.find((x) => x.id === secondaryId));
    if (b.mergedIntoId) fail("Ce client a déjà été fusionné.");
    const counts = mergePreview(d, secondaryId);
    const re = <T extends { clientId?: string }>(list: T[]) => list.forEach((x) => x.clientId === secondaryId && (x.clientId = primaryId));
    d.patients.forEach((p) => {
      if (p.ownerId === secondaryId) p.ownerId = primaryId;
      p.ownerHistory.forEach((h) => h.clientId === secondaryId && (h.clientId = primaryId));
    });
    [d.appointments, d.consultations, d.invoices, d.quotes, d.payments, d.tasks, d.interactions, d.prescriptions, d.hospitalizations, d.credits, d.openingReceivables].forEach((l) => re(l as { clientId?: string }[]));
    d.farms.forEach((f) => f.clientId === secondaryId && (f.clientId = primaryId));
    d.documents.forEach((doc) => doc.linked.kind === "client" && doc.linked.id === secondaryId && (doc.linked.id = primaryId));
    a.notes.push(...b.notes, { id: uid("note"), text: `Fusion avec ${b.code} (${b.name}). Motif : ${reason}`, authorId: ctx.user.id, date: ctx.now });
    a.contacts.push(...b.contacts.filter((c) => !a.contacts.some((x) => x.phone === c.phone)));
    b.status = "archive";
    b.mergedIntoId = primaryId;
    audit(d, ctx, {
      module: "Clients",
      action: "Fusion supervisée",
      target: `${b.code} → ${a.code}`,
      reason,
      newValue: `${counts.patients} patient(s), ${counts.invoices} facture(s), ${counts.appointments} RDV rattachés`,
    });
    return { message: `Fusion effectuée : ${b.code} rattaché à ${a.code}.` };
  });

export function mergePreview(db: DemoDB, clientId: string) {
  return {
    patients: db.patients.filter((p) => p.ownerId === clientId).length,
    appointments: db.appointments.filter((x) => x.clientId === clientId).length,
    consultations: db.consultations.filter((x) => x.clientId === clientId).length,
    invoices: db.invoices.filter((x) => x.clientId === clientId).length,
    payments: db.payments.filter((x) => x.clientId === clientId).length,
    farms: db.farms.filter((x) => x.clientId === clientId).length,
    documents: db.documents.filter((x) => x.linked.kind === "client" && x.linked.id === clientId).length,
  };
}

/** Détection visuelle des doublons potentiels (même téléphone ou nom très proche). */
export function findDuplicates(db: DemoDB, client: Pick<Client, "id" | "name" | "phone">): Client[] {
  const tokens = (s: string) => normalize(s).split(/[^a-z]+/).filter(Boolean).sort().join(" ");
  const phone = client.phone.replace(/\D/g, "");
  const nt = tokens(client.name);
  return db.clients.filter(
    (c) =>
      c.id !== client.id &&
      c.status === "actif" &&
      ((phone.length >= 8 && c.phone.replace(/\D/g, "") === phone) || (nt.length > 3 && tokens(c.name) === nt)),
  );
}

export function duplicateGroups(db: DemoDB): Client[][] {
  const seen = new Set<string>();
  const groups: Client[][] = [];
  for (const c of db.clients) {
    if (seen.has(c.id) || c.status !== "actif") continue;
    const dups = findDuplicates(db, c);
    if (dups.length) {
      const g = [c, ...dups];
      g.forEach((x) => seen.add(x.id));
      groups.push(g);
    }
  }
  return groups;
}
