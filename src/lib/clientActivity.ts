/**
 * Un seul dossier client, plusieurs activités : animaux de compagnie (clinique),
 * animaux de rente (rural), achats au comptoir de la pharmacie.
 */
import { RENTE_SPECIES } from "./followup";
import type { Client, DemoDB, Invoice, Payment } from "./types";

export type Activity = "compagnie" | "rente" | "pharmacie";

export const ACTIVITY_META: Record<Activity, { label: string; short: string; cls: string; dot: string }> = {
  compagnie: { label: "Animaux de compagnie", short: "Compagnie", cls: "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300", dot: "bg-brand-500" },
  rente: { label: "Animaux de rente", short: "Rente", cls: "bg-orange-50 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300", dot: "bg-orange-500" },
  pharmacie: { label: "Pharmacie (comptoir)", short: "Pharmacie", cls: "bg-tertiary-50 text-tertiary-700 dark:bg-tertiary-500/15 dark:text-tertiary-300", dot: "bg-tertiary-500" },
};

export function activitiesOf(db: DemoDB, c: Client): Activity[] {
  const out: Activity[] = [];
  const pets = db.patients.filter((p) => p.ownerId === c.id && !RENTE_SPECIES.includes(p.species));
  const farmAnimals = db.patients.filter((p) => p.ownerId === c.id && RENTE_SPECIES.includes(p.species));
  if (pets.length) out.push("compagnie");
  if (farmAnimals.length || db.farms.some((f) => f.clientId === c.id) || c.segment === "eleveur") out.push("rente");
  if (db.invoices.some((i) => i.clientId === c.id && i.channel === "comptoir")) out.push("pharmacie");
  return out;
}

/** Normalise un numéro pour la détection de doublons (chiffres seulement, sans indicatif 225). */
export const phoneKey = (s: string) => {
  const d = s.replace(/\D/g, "");
  return d.length > 10 && d.startsWith("225") ? d.slice(3) : d;
};

/** Recherche « avant création » : nom, téléphone (principal ou contacts), exploitation. */
export function findClients(db: DemoDB, q: string): Client[] {
  const s = q.trim().toLowerCase();
  if (s.length < 2) return [];
  const digits = phoneKey(s);
  return db.clients
    .filter((c) => c.status === "actif" && !c.mergedIntoId && !c.isWalkIn)
    .filter((c) => {
      if (c.name.toLowerCase().includes(s)) return true;
      if (digits.length >= 4 && (phoneKey(c.phone).includes(digits) || c.contacts.some((x) => phoneKey(x.phone).includes(digits)))) return true;
      return db.farms.some((f) => f.clientId === c.id && f.name.toLowerCase().includes(s));
    })
    .slice(0, 8);
}

export const WALK_IN_ID = "cli-passage";

/* ---------------- Migration v8 → v9 : comptoir, recommandants, sources ---------------- */

const SOURCES = ["Bouche-à-oreille", "Recommandé par un client", "Réseaux sociaux", "Passage devant la pharmacie", "Délégué / laboratoire"];

export function migrateToV9(db: DemoDB, today: string): DemoDB {
  const clients = db.clients.map((c) => ({ ...c }));
  const real = clients.filter((c) => !c.isWalkIn && c.status === "actif");
  real.forEach((c, i) => {
    if (c.acquisition === undefined) c.acquisition = SOURCES[i % SOURCES.length];
  });
  // Quelques recommandations entre clients (démonstration).
  const refs: [number, number][] = [[3, 0], [5, 0], [7, 1], [9, 1], [11, 0], [13, 2]];
  for (const [a, b] of refs) {
    if (real[a] && real[b] && !real[a].referredBy) {
      real[a].referredByClientId = real[b].id;
      real[a].referredBy = real[b].name;
      real[a].acquisition = "Recommandé par un client";
    }
  }
  const invoices: Invoice[] = [...db.invoices];
  const payments: Payment[] = [...db.payments];
  const counters = { ...db.counters };
  if (!invoices.some((i) => i.channel === "comptoir")) {
    const products = db.products.filter((p) => p.status === "actif" && p.salePrice > 0 && ["medicament", "antiparasitaire", "vaccin", "aliment"].includes(p.category));
    const farmers = real.filter((c) => db.farms.some((f) => f.clientId === c.id) || c.segment === "eleveur");
    const buyers = [...farmers, ...real.slice(0, 4)];
    const cash = db.accounts.find((a) => a.type === "caisse" && a.establishmentId === db.establishments[0].id) ?? db.accounts[0];
    const purposes = ["Vermifugation", "Toux et râles", "Diarrhée", "Vaccination de bande", "Plaie", "Baisse de ponte", "Tiques", ""];
    const speciesList = ["Volaille", "Bovin", "Porcin", "Chien", "Ovin", "Volaille", "Caprin", "Chat"];
    const author = db.users.find((u) => u.roleId === "accueil")?.id ?? db.users[0].id;
    for (let k = 0; k < 14 && buyers.length && products.length; k++) {
      const client = buyers[k % buyers.length];
      const date = (() => {
        const d = new Date(`${today}T12:00:00`);
        d.setDate(d.getDate() - (k * 4 + 1));
        return d.toISOString().slice(0, 10);
      })();
      const p1 = products[(k * 3) % products.length];
      const p2 = products[(k * 5 + 2) % products.length];
      const lines = [p1, ...(k % 3 === 0 ? [p2] : [])].map((p, j) => ({ id: `il-cs${k}-${j}`, label: p.brandName ?? p.name, kind: "produit" as const, productId: p.id, qty: 1 + ((k + j) % 3), unitPrice: p.salePrice, discountPct: 0, source: { kind: "vente" as const, id: `inv-cs${k}`, label: "Comptoir" } }));
      const total = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
      counters.invoice = (counters.invoice ?? 0) + 1;
      const code = `${db.settings.invoicePrefix}-${String(counters.invoice).padStart(4, "0")}`;
      invoices.unshift({ id: `inv-cs${k}`, code, kind: "facture", channel: "comptoir", clientId: client.id, payerName: client.name, establishmentId: db.establishments[0].id, date, dueDate: date, lines, status: "validee", authorId: author, validatedById: author, validatedAt: `${date}T10:00:00`, creditNoteIds: [], fiscalStatus: "a_transmettre_backend", notes: "Vente comptoir (historique de démonstration)", saleInfo: { species: speciesList[k % speciesList.length], purpose: purposes[k % purposes.length] || undefined, sellerId: author } });
      counters.payment = (counters.payment ?? 0) + 1;
      payments.unshift({ id: `pay-cs${k}`, code: `DEMO-ENC-${String(counters.payment).padStart(4, "0")}`, date, clientId: client.id, amount: total, method: "especes", accountId: cash.id, kind: "reglement", allocations: [{ invoiceId: `inv-cs${k}`, amount: total }], reference: "", userId: author, opKey: `seed-cs${k}`, note: "Vente comptoir (démo)" });
    }
  }
  return { ...db, schemaVersion: 9, clients, invoices, payments, counters };
}
