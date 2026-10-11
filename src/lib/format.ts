/** Formatage fr-FR / XOF (FCFA). */

const xof = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "XOF",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
const dateLong = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const timeFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

export const formatXOF = (n: number) => xof.format(Math.round(n || 0));
export const formatNumber = (n: number) => num.format(n || 0);

function toDate(d: string | Date | undefined): Date | null {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d.length === 10 ? `${d}T00:00:00` : d) : d;
  return Number.isNaN(date.getTime()) ? null : date;
}

export const formatDate = (d?: string | Date) => {
  const x = toDate(d);
  return x ? dateFmt.format(x) : "—";
};
export const formatDateLong = (d?: string | Date) => {
  const x = toDate(d);
  return x ? dateLong.format(x) : "—";
};
export const formatDateTime = (d?: string | Date) => {
  const x = toDate(d);
  return x ? dateTimeFmt.format(x) : "—";
};
export const formatTime = (d?: string | Date) => {
  const x = toDate(d);
  return x ? timeFmt.format(x) : "—";
};

/** Date locale au format AAAA-MM-JJ (sans décalage UTC). */
export function isoDay(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Datetime locale au format AAAA-MM-JJTHH:mm. */
export function isoLocal(d: Date = new Date()): string {
  return `${isoDay(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function addDays(base: string | Date, days: number): string {
  const d = toDate(base) ?? new Date();
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return isoDay(r);
}

export function daysBetween(a: string, b: string): number {
  const da = toDate(a);
  const db = toDate(b);
  if (!da || !db) return 0;
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

export function ageFrom(birth: string, now: string = isoDay()): string {
  const months = Math.max(0, Math.floor(daysBetween(birth, now) / 30.44));
  if (months < 12) return `${months} mois`;
  const y = Math.floor(months / 12);
  return `${y} an${y > 1 ? "s" : ""}`;
}

export function uid(prefix = "id"): string {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}${rnd}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
