/**
 * Plateforme Cliva : cliniques clientes, licences (vente directe + maintenance),
 * usage anonymisé et campagnes publicitaires diffusées dans les cliniques.
 */
import { addDays, daysBetween } from "./format";
import type { AdCampaign, Announcement, DemoDB, PlatformClinic, UsageMonth } from "./types";

export const SELF_CLINIC_ID = "cli-self";

export const COUNTRIES = ["Côte d'Ivoire", "Sénégal", "Burkina Faso", "Mali", "Bénin", "Togo", "Cameroun", "Guinée", "Niger", "Gabon", "RD Congo", "Congo", "Madagascar", "France", "Belgique", "Ghana", "Nigeria", "Kenya", "Rwanda"];
export const LANG_LABEL: Record<string, string> = { fr: "Français", en: "Anglais" };
export const CLIENTELE_LABEL: Record<string, string> = { compagnie: "Animaux de compagnie", rente: "Animaux de rente", mixte: "Mixte" };

/** Modules comptés dans l'usage (sans contenu). */
export const USAGE_MODULES: Record<string, string> = {
  Agenda: "Agenda",
  Consultations: "Consultations",
  Stock: "Pharmacie et stock",
  Facturation: "Facturation",
  Finances: "Finances",
  Exploitations: "Élevages",
  Missions: "Missions",
  Clients: "Clients",
  Patients: "Patients",
};

/** Usage du mois pour la clinique de la démo, calculé en direct (comptages uniquement). */
export function selfUsage(db: DemoDB, month: string): UsageMonth {
  const inM = (d?: string) => !!d && d.slice(0, 7) === month;
  const aud = db.audit.filter((a) => inM(a.date));
  const modules: Record<string, number> = {};
  for (const a of aud) modules[a.module] = (modules[a.module] ?? 0) + 1;
  return {
    month,
    activeUsers: new Set(aud.map((a) => a.userId)).size || db.users.filter((u) => u.active && u.roleId !== "confrere").length,
    actions: aud.length,
    consultations: db.consultations.filter((c) => inM(c.date)).length,
    appointments: db.appointments.filter((a) => inM(a.start)).length,
    sales: db.invoices.filter((i) => i.channel === "comptoir" && inM(i.date)).length,
    invoices: db.invoices.filter((i) => i.kind === "facture" && inM(i.date)).length,
    modules,
  };
}

export function usageOf(db: DemoDB, c: PlatformClinic, month: string): UsageMonth | undefined {
  if (c.isSelf) return selfUsage(db, month);
  return c.usage.find((u) => u.month === month);
}

export const months = (today: string, n: number) => {
  const d = new Date(`${today.slice(0, 7)}-01T00:00:00`);
  return Array.from({ length: n }, (_, i) => new Date(d.getFullYear(), d.getMonth() - (n - 1 - i), 1).toLocaleDateString("sv-SE").slice(0, 7));
};

export type MaintenanceState = "a_jour" | "a_renouveler" | "en_retard" | "sans";
export const MAINT_LABEL: Record<MaintenanceState, { label: string; tone: string }> = {
  a_jour: { label: "Maintenance à jour", tone: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-300" },
  a_renouveler: { label: "À renouveler", tone: "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-300" },
  en_retard: { label: "Maintenance en retard", tone: "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-300" },
  sans: { label: "Sans maintenance", tone: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400" },
};

/** État de la maintenance : à jour, à renouveler (30 j avant), en retard (après la tolérance). */
export function maintenanceState(c: PlatformClinic, today: string, graceDays: number): { state: MaintenanceState; days: number | null } {
  if (!c.paidUntil) return { state: "sans", days: null };
  const left = daysBetween(today, c.paidUntil);
  if (left >= 30) return { state: "a_jour", days: left };
  if (left >= -graceDays) return { state: "a_renouveler", days: left };
  return { state: "en_retard", days: left };
}

export const licencePaid = (c: PlatformClinic) => c.payments.filter((p) => p.kind === "licence").reduce((s, p) => s + p.amount, 0);

/** Prochaine date de couverture après un paiement de maintenance. */
export function extendCoverage(c: PlatformClinic, from: string, periods = 1) {
  const start = c.paidUntil && c.paidUntil > from ? c.paidUntil : from;
  const d = new Date(`${start}T00:00:00`);
  if (c.maintenancePeriod === "annuel") d.setFullYear(d.getFullYear() + periods);
  else d.setMonth(d.getMonth() + periods);
  return d.toLocaleDateString("sv-SE");
}

/** Une campagne vise-t-elle cette clinique ? */
export function targets(c: AdCampaign, clinic: PlatformClinic) {
  const t = c.target;
  if (t.clinicIds.length) return t.clinicIds.includes(clinic.id);
  return (!t.countries.length || t.countries.includes(clinic.country)) && (!t.languages.length || t.languages.includes(clinic.language)) && (!t.clienteles.length || t.clienteles.includes(clinic.clientele));
}

export const campaignLive = (c: AdCampaign, today: string) => c.active && (!c.from || c.from <= today) && (!c.to || c.to >= today);

export function selfClinic(db: DemoDB) {
  return db.platform?.clinics.find((c) => c.isSelf);
}

/** Campagnes de l'éditeur à afficher dans la clinique de la démo (format annonce). */
export function platformAnnouncements(db: DemoDB, placement: Announcement["placements"][number], today: string): Announcement[] {
  const me = selfClinic(db);
  if (!me || !db.platform) return [];
  return db.platform.campaigns
    .filter((c) => campaignLive(c, today) && c.placements.includes(placement) && targets(c, me))
    .map((c, i) => ({ id: `cmp:${c.id}`, kind: "pub" as const, sponsor: c.sponsor, title: c.title, text: c.text, imageDataUrl: c.imageDataUrl, link: c.link, placements: c.placements, active: true, order: -100 + i, createdAt: c.createdAt, views: 0, clicks: 0, platform: true }));
}

export function campaignTotals(c: AdCampaign) {
  const v = Object.values(c.stats);
  const views = v.reduce((s, x) => s + x.views, 0);
  const clicks = v.reduce((s, x) => s + x.clicks, 0);
  return { views, clicks, ctr: views ? Math.round((clicks / views) * 1000) / 10 : 0, reach: v.filter((x) => x.views > 0).length };
}

/** Synthèse financière de la plateforme. */
export function platformMoney(db: DemoDB, today: string) {
  const p = db.platform;
  if (!p) return { licences: 0, maintenance: 0, yearMaintenance: 0, receivable: 0, due30: 0, monthlyRecurring: 0, ads: 0 };
  const y = today.slice(0, 4);
  const pays = p.clinics.flatMap((c) => c.payments);
  const active = p.clinics.filter((c) => c.status === "actif");
  return {
    licences: pays.filter((x) => x.kind === "licence").reduce((s, x) => s + x.amount, 0),
    maintenance: pays.filter((x) => x.kind === "maintenance").reduce((s, x) => s + x.amount, 0),
    yearMaintenance: pays.filter((x) => x.kind === "maintenance" && x.date.startsWith(y)).reduce((s, x) => s + x.amount, 0),
    /** Reste à encaisser sur les licences vendues. */
    receivable: p.clinics.filter((c) => c.status !== "prospect").reduce((s, c) => s + Math.max(0, c.licencePrice - licencePaid(c)), 0),
    /** Maintenances qui arrivent à échéance dans 30 jours ou sont en retard. */
    due30: active.filter((c) => c.paidUntil && c.paidUntil <= addDays(today, 30)).reduce((s, c) => s + c.maintenanceAmount, 0),
    monthlyRecurring: Math.round(active.reduce((s, c) => s + (c.maintenancePeriod === "annuel" ? c.maintenanceAmount / 12 : c.maintenanceAmount), 0)),
    ads: p.campaigns.reduce((s, c) => s + (c.price ?? 0), 0),
  };
}
