/**
 * Annonces et actualités en rotation (image ou GIF + lien) : espace partenaires
 * pour les laboratoires et informations de la clinique.
 */
import { platformAnnouncements } from "./platform";
import type { Announcement, DemoDB } from "./types";

export const PLACEMENTS: { key: Announcement["placements"][number]; label: string }[] = [
  { key: "dashboard", label: "Tableau de bord" },
  { key: "connexion", label: "Page de connexion" },
  { key: "pharmacie", label: "Vente pharmacie" },
];

export function liveAnnouncements(db: DemoDB, placement: Announcement["placements"][number], today: string): Announcement[] {
  // Les campagnes de l'éditeur passent en premier et ne peuvent pas être retirées par la clinique.
  return [...platformAnnouncements(db, placement, today), ...ownAnnouncements(db, placement, today)];
}

function ownAnnouncements(db: DemoDB, placement: Announcement["placements"][number], today: string): Announcement[] {
  return (db.announcements ?? [])
    .filter((a) => a.active && a.placements.includes(placement) && (!a.from || a.from <= today) && (!a.to || a.to >= today) && (a.imageDataUrl || a.title))
    .sort((a, b) => a.order - b.order);
}

/** Bannière SVG de démonstration (aucune image externe). */
function banner(bg: string, accent: string, label: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="${bg}"/><circle cx="520" cy="80" r="140" fill="${accent}" opacity=".35"/><circle cx="560" cy="300" r="90" fill="${accent}" opacity=".25"/><text x="40" y="200" font-family="Arial, sans-serif" font-size="44" font-weight="700" fill="#fff">${label}</text></svg>`;
  return `data:image/svg+xml;base64,${typeof btoa === "function" ? btoa(unescape(encodeURIComponent(svg))) : Buffer.from(svg).toString("base64")}`;
}

export function migrateToV10(db: DemoDB, today: string): DemoDB {
  if (db.announcements) return { ...db, schemaVersion: 10 };
  const list: Announcement[] = [];
  const p = db.settings.promo;
  if (p?.title) list.push({ id: "ann-promo", kind: "pub", title: p.title, text: p.text, imageDataUrl: p.imageDataUrl || undefined, link: p.link || undefined, placements: ["dashboard"], from: p.from || undefined, to: p.to || undefined, active: p.active, order: 0, createdAt: today, views: 0, clicks: 0 });
  list.push(
    { id: "ann-1", kind: "pub", sponsor: "Laboratoire partenaire (fictif)", title: "Vaccin Newcastle : offre éleveurs", text: "Conditionnement 1 000 doses, remise de lancement sur les commandes groupées ce mois-ci.", imageDataUrl: banner("#0b6b3a", "#6ad09a", "Newcastle 1000 doses"), link: "/stock/vente", placements: ["dashboard", "pharmacie"], active: true, order: 1, createdAt: today, views: 0, clicks: 0 },
    { id: "ann-2", kind: "actualite", title: "Campagne de vaccination antirabique", text: "Les rappels de vaccination antirabique sont ouverts : pensez à relancer les propriétaires de chiens.", imageDataUrl: banner("#015d78", "#4fc3e8", "Rage : on vaccine"), link: "/relation-client/suivi", placements: ["dashboard", "connexion"], active: true, order: 2, createdAt: today, views: 0, clicks: 0 },
    { id: "ann-3", kind: "pub", sponsor: "Distributeur d'aliments (fictif)", title: "Aliment ponte démarrage", text: "Nouveau prémix disponible au comptoir. Fiche technique sur demande.", imageDataUrl: banner("#9a3412", "#fdba74", "Prémix ponte"), link: "/stock", placements: ["dashboard", "pharmacie"], active: true, order: 3, createdAt: today, views: 0, clicks: 0 },
  );
  return { ...db, schemaVersion: 10, announcements: list };
}
