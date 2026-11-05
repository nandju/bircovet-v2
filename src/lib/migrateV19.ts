/**
 * Schéma v19 : plateforme Cliva (compte éditeur, cliniques clientes, licences, campagnes).
 * En production, ces données vivent dans une base séparée de celles des cliniques.
 */
import { addDays } from "./format";
import { months, SELF_CLINIC_ID } from "./platform";
import type { AdCampaign, DemoDB, PlatformClinic, UsageMonth } from "./types";

function banner(bg: string, accent: string, label: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="${bg}"/><circle cx="520" cy="80" r="140" fill="${accent}" opacity=".35"/><circle cx="560" cy="300" r="90" fill="${accent}" opacity=".25"/><text x="40" y="200" font-family="Arial, sans-serif" font-size="40" font-weight="700" fill="#fff">${label}</text></svg>`;
  return `data:image/svg+xml;base64,${typeof btoa === "function" ? btoa(unescape(encodeURIComponent(svg))) : Buffer.from(svg).toString("base64")}`;
}

/** Usage fictif et stable (aucune donnée réelle). */
function fakeUsage(seed: number, size: number, today: string, startMonth?: string): UsageMonth[] {
  return months(today, 6)
    .filter((m) => !startMonth || m >= startMonth)
    .map((m, i) => {
      const k = size * (0.8 + ((seed * 7 + i * 3) % 5) / 10);
      const c = Math.round(k * 40);
      return { month: m, activeUsers: Math.max(1, Math.round(size * 1.5)), actions: Math.round(k * 220), consultations: c, appointments: Math.round(c * 1.2), sales: Math.round(k * 55), invoices: Math.round(c * 0.9), modules: { Agenda: Math.round(k * 60), Consultations: Math.round(k * 50), Stock: Math.round(k * 45), Facturation: Math.round(k * 30), Finances: Math.round(k * 15), Exploitations: Math.round(k * (seed % 2 ? 20 : 2)) } };
    });
}

export function migrateToV19(db: DemoDB, nowLocal: string): DemoDB {
  const today = nowLocal.slice(0, 10);
  if (db.platform) return { ...db, schemaVersion: 19 };
  const est = db.establishments[0]?.id ?? "est-abj";
  const y = (n: number) => addDays(today, n);
  const C = (id: string, name: string, country: string, city: string, language: "fr" | "en", clientele: PlatformClinic["clientele"], licencePrice: number, paid: number[], soldDays: number | undefined, paidUntilDays: number | undefined, size: number, extra: Partial<PlatformClinic> = {}): PlatformClinic => ({
    id, name, country, city, language, clientele, contactName: "Contact fictif", phone: "+000 00 00 00 00", email: `contact@${id}.demo`,
    status: soldDays === undefined ? "prospect" : "actif", licencePrice, soldAt: soldDays === undefined ? undefined : y(soldDays),
    maintenanceAmount: 25_000, maintenancePeriod: "mensuel", paidUntil: paidUntilDays === undefined ? undefined : y(paidUntilDays),
    payments: paid.map((a, i) => ({ id: `${id}-p${i}`, date: y((soldDays ?? 0) + i * 30), amount: a, kind: "licence" as const })),
    users: Math.round(size * 2), sites: size > 2 ? 2 : 1, version: "2.0", usage: soldDays === undefined ? [] : fakeUsage(id.length, size, today, y(soldDays).slice(0, 7)), createdAt: y((soldDays ?? -10) - 20), ...extra,
  });
  const clinics: PlatformClinic[] = [
    { ...C(SELF_CLINIC_ID, db.settings.clinicName || "BIRCOVET", "Côte d'Ivoire", "Abidjan", "fr", "mixte", 3_500_000, [3_500_000], -200, 40, 3), isSelf: true, contactName: "Direction", email: db.settings.email, phone: db.settings.phone, notes: "Clinique pilote." },
    C("clin-dkr", "Clinique vétérinaire des Almadies (fictive)", "Sénégal", "Dakar", "fr", "compagnie", 3_800_000, [2_000_000, 1_800_000], -150, 20, 2),
    C("clin-ouaga", "Cabinet vétérinaire du Faso (fictif)", "Burkina Faso", "Ouagadougou", "fr", "rente", 3_000_000, [1_500_000], -90, 12, 2),
    C("clin-dla", "VetCare Douala (fictive)", "Cameroun", "Douala", "fr", "mixte", 4_000_000, [4_000_000], -60, -20, 3),
    C("clin-acc", "Accra Animal Hospital (fictive)", "Ghana", "Accra", "en", "compagnie", 4_000_000, [4_000_000], -40, -45, 2),
    C("clin-bko", "Clinique du Fleuve (fictive)", "Mali", "Bamako", "fr", "rente", 3_200_000, [], undefined, undefined, 1),
    C("clin-lfw", "Cabinet vétérinaire de Lomé (fictif)", "Togo", "Lomé", "fr", "mixte", 3_500_000, [3_500_000], -20, 10, 1),
  ];
  for (const c of clinics) if (c.paidUntil && c.soldAt) c.payments.push({ id: `${c.id}-m`, date: y(-5), amount: c.maintenanceAmount, kind: "maintenance", coversUntil: c.paidUntil });
  const campaigns: AdCampaign[] = [
    { id: "cmp-1", title: "Vaccins volaille : stock disponible dans votre pays", sponsor: "Laboratoire partenaire (fictif)", text: "Commandez groupé via votre distributeur : remise de lancement réservée aux cliniques Cliva.", imageDataUrl: banner("#1e3a8a", "#93c5fd", "Vaccins volaille"), link: "https://example.com", placements: ["dashboard", "pharmacie"], active: true, target: { countries: [], languages: ["fr"], clienteles: ["rente", "mixte"], clinicIds: [] }, stats: { "clin-ouaga": { views: 412, clicks: 23 }, "clin-dla": { views: 380, clicks: 17 } }, price: 250_000, createdAt: y(-20), from: y(-20), to: y(40) },
    { id: "cmp-2", title: "Nouvelle gamme antiparasitaire chien et chat", sponsor: "Distributeur partenaire (fictif)", text: "Fiches techniques et kit de présentation au comptoir offerts aux cliniques partenaires.", imageDataUrl: banner("#7c2d12", "#fdba74", "Antiparasitaires"), placements: ["dashboard"], active: true, target: { countries: [], languages: [], clienteles: ["compagnie", "mixte"], clinicIds: [] }, stats: { "clin-dkr": { views: 520, clicks: 31 }, "clin-acc": { views: 290, clicks: 9 } }, price: 180_000, createdAt: y(-10), from: y(-10) },
  ];
  const editor = { id: "u-editeur", name: "Éditeur Cliva", email: "editeur@cliva.demo", roleId: "editeur" as const, establishmentId: est, title: "Éditeur de la plateforme", phone: "", active: true, createdAt: y(-365), demoPassword: db.users[0]?.demoPassword ?? "demo" };
  return {
    ...db,
    schemaVersion: 19,
    platform: {
      editor,
      clinics,
      campaigns,
      offer: { licencePrice: 3_500_000, maintenanceAmount: 25_000, maintenancePeriod: "mensuel", graceDays: 15, notes: "Mises à jour de l'application, assistance par téléphone et WhatsApp, sauvegardes, nouveaux tutoriels." },
    },
  };
}
