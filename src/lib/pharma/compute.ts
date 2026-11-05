/**
 * Calcul de dose — reprise fidèle des règles du prototype Formulaire BIRCOVET (fonction compute()).
 * Le module ne prescrit pas : il calcule une quantité, un volume ou un nombre de comprimés
 * à partir d'une fourchette de référence. La décision reste au vétérinaire.
 */
import { routeMismatch } from "./indexPosology";
import { familyName, speciesOf, type AlertLevel, type Molecule, type Posology, type SpeciesCode } from "./model";

export type ConcUnit = "mg/mL" | "µg/mL" | "%" | "mg/comprimé" | "UI/mL";
export const CONC_UNITS: ConcUnit[] = ["mg/mL", "µg/mL", "%", "mg/comprimé", "UI/mL"];

export interface CalcAlert {
  level: AlertLevel;
  text: string;
  /** Calcul interdit (ex. chat + paracétamol). */
  block?: boolean;
}

export interface CalcInput {
  molecule: Molecule;
  posology: Posology;
  species: SpeciesCode;
  kg: number;
  dose: number;
  conc?: number;
  concUnit?: ConcUnit;
  /** Animaux de rente : délais d'attente de l'étiquette du produit. */
  withdrawal?: { meatDays?: number; milkDays?: number; lastDose?: string };
  productName?: string;
  humanProduct?: boolean;
  /** Produit en main : voies autorisées, flacon reconstitué, apport de chaque composant. */
  productInfo?: { routes?: string[]; vial?: { volumeMl: number; basisMg: number; note?: string }; components?: { name: string; mgPerMl: number }[] };
}

export interface CalcResult {
  label: string;
  main: string;
  mainUnit: string;
  sub: string;
  status: "ok" | "hors_fourchette" | "limite";
  rows: [string, string][];
  alerts: CalcAlert[];
  copy: string;
  blocked: boolean;
  amount: number;
  volumeMl: number;
}

const fmt = (n: number, d = 2) => (Number.isFinite(n) ? n.toLocaleString("fr-FR", { maximumFractionDigits: d }) : "—");
const parseU = (u: string) => {
  const p = u.split("/");
  return { num: p[0], per: p.slice(1).join("/") };
};
const toMg = (a: number, num: string) => (num === "µg" ? a / 1000 : num === "g" ? a * 1000 : a);
function quarter(n: number) {
  const q = Math.round(n * 4) / 4;
  const w = Math.floor(q);
  const f = q - w;
  const fr = ({ 0: "", 0.25: "¼", 0.5: "½", 0.75: "¾" } as Record<number, string>)[f];
  return { q, txt: w ? `${w}${fr ? ` ${fr}` : ""}` : fr || "0" };
}
function addDaysLong(iso: string, n: number) {
  const t = new Date(`${iso}T12:00:00`);
  t.setDate(t.getDate() + n);
  return t.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

/* ---------------- Règles d'alerte automatiques (espèce × famille ou molécule) ---------------- */

export interface AlertRule {
  species: SpeciesCode[] | "rente" | "all";
  family?: string;
  moleculeMatch?: RegExp;
  level: AlertLevel;
  text: string;
  block?: boolean;
}

export const ALERT_RULES: AlertRule[] = [
  { species: ["ca"], moleculeMatch: /^parac[eé]tamol/i, level: "danger", block: true, text: "Chat : paracétamol MORTEL même à faible dose (méthémoglobinémie). Calcul bloqué." },
  { species: ["ca"], moleculeMatch: /^perm[eé]thrine/i, level: "danger", block: true, text: "Chat : perméthrine MORTELLE (convulsions). Calcul bloqué." },
  { species: ["la"], family: "atb", level: "danger", text: "Lapin : ne jamais donner per os amoxicilline, ampicilline, pénicillines, céphalosporines, clindamycine, lincomycine ou érythromycine (entérotoxémie mortelle)." },
  { species: ["eq"], family: "atb", level: "danger", text: "Cheval : lincomycine, clindamycine et macrolides oraux chez l'adulte provoquent des colites mortelles. Ionophores (monensin) mortels." },
  { species: "rente", family: "atb", level: "danger", text: "Interdits chez les animaux de rente : chloramphénicol, nitrofuranes, métronidazole et autres nitro-imidazoles, dapsone. Fluoroquinolones et céphalosporines 3G/4G : réservées après antibiogramme." },
  { species: ["cp"], family: "para", level: "info", text: "Caprins : les anthelminthiques sont éliminés plus vite. Doses souvent 1,5 à 2 fois celles des ovins (hors AMM) ; un sous-dosage favorise les résistances." },
  { species: "rente", moleculeMatch: /chloramph[eé]nicol|nitrofur|m[eé]tronidazole|dimetridazole|dapsone/i, level: "danger", block: true, text: "Substance interdite chez les animaux destinés à la consommation. Calcul bloqué." },
];

export function rulesFor(m: Molecule, sp: SpeciesCode): CalcAlert[] {
  const rente = speciesOf(sp)?.rente ?? false;
  return ALERT_RULES.filter((r) => (r.species === "all" || (r.species === "rente" ? rente : r.species.includes(sp))) && (!r.family || r.family === m.family) && (!r.moleculeMatch || r.moleculeMatch.test(m.name) || m.synonyms.some((s) => r.moleculeMatch!.test(s)))).map((r) => ({ level: r.level, text: r.text, block: r.block }));
}

/* ---------------- Calcul ---------------- */

export function compute(input: CalcInput): CalcResult | null {
  const { molecule: d, posology: c, species, kg, dose } = input;
  if (!(kg > 0) || !(dose >= 0)) return null;
  const U = parseU(c.unit);
  const alerts: CalcAlert[] = [];
  const rows: [string, string][] = [];
  let main = "—";
  let mainUnit = "";
  let sub = "";
  let prodLine = "";
  let vol = 0;
  const cap = c.bound === "plafond";
  const floor = c.bound === "minimum";
  let status: CalcResult["status"] = "ok";
  if ((cap && dose > c.max + 1e-9) || (floor && dose < c.min - 1e-9)) status = "limite";
  else if (!cap && !floor && (dose < c.min - 1e-9 || dose > c.max + 1e-9)) status = "hors_fourchette";

  const perKg = U.per.startsWith("kg");
  const perL = U.per === "L";
  const hourly = U.per.endsWith("/h");
  const amount = perKg ? dose * kg : dose;
  const spName = speciesOf(species)?.name ?? species;
  const label = `${d.name}${input.productName ? ` (${input.productName})` : ""} — ${spName} ${fmt(kg, 2)} kg`;
  const conc = input.conc ?? NaN;
  const cu = input.concUnit;

  if (U.num === "mL") {
    if (!hourly) vol = amount;
    main = fmt(amount, 2);
    mainUnit = hourly ? "mL/h" : "mL";
    sub = hourly ? "à régler sur la pompe ou le perfuseur" : "par administration";
    if (hourly) rows.push(["Volume sur 24 h", `${fmt(amount * 24, 0)} mL`]);
    prodLine = `→ ${fmt(amount, 2)} ${hourly ? "mL/h" : "mL"}`;
  } else if (perL) {
    main = fmt(dose, 1);
    mainUnit = `${U.num}/L`;
    sub = "d'eau de boisson";
    if (conc > 0 && cu && cu !== "mg/comprimé") {
      const per = cu === "mg/mL" ? conc : cu === "µg/mL" ? conc / 1000 : cu === "%" ? conc * 10 : NaN;
      if (Number.isFinite(per)) {
        const ml = toMg(dose, U.num) / per;
        rows.push(["Produit à diluer", `${fmt(ml, 2)} mL par litre`]);
        rows.push(["Pour 10 L", `${fmt(ml * 10, 1)} mL`]);
        prodLine = `= ${fmt(ml, 2)} mL de produit par litre`;
      }
    }
    if (species === "la") {
      rows.push(["Eau bue (≈ 10 % du poids)", `${fmt(kg * 0.1 * 1000, 0)} mL/j`]);
      rows.push(["Dose ingérée estimée", `${fmt(dose * 0.1, 1)} ${U.num}/kg/j`]);
      alerts.push({ level: "info", text: "Le lapin boit environ 10 % de son poids par jour : la dose réelle dépend de l'abreuvement. Retirer toute autre source d'eau." });
    }
  } else if (U.num === "UI") {
    if (conc > 0 && cu === "UI/mL") {
      const ml = amount / conc;
      vol = ml;
      main = fmt(ml, ml < 1 ? 3 : 2);
      mainUnit = "mL";
      sub = `de solution à ${fmt(conc, 0)} UI/mL`;
      prodLine = `= ${fmt(ml, ml < 1 ? 3 : 2)} mL à ${fmt(conc, 0)} UI/mL`;
      if (ml < 0.1) alerts.push({ level: "warn", text: "Volume inférieur à 0,1 mL : diluer ou utiliser une seringue à insuline." });
    } else {
      main = fmt(amount, 0);
      mainUnit = "UI";
      sub = "Saisir la concentration en UI/mL pour obtenir le volume.";
    }
    rows.unshift(["Quantité", `${fmt(amount, 0)} UI`]);
  } else {
    const mg = toMg(amount, U.num);
    if (conc > 0 && cu && cu !== "UI/mL") {
      if (cu === "mg/comprimé") {
        const n = mg / conc;
        const qt = quarter(n);
        main = qt.txt;
        mainUnit = "cp";
        sub = `de ${fmt(conc, 3)} mg — calcul exact ${fmt(n, 2)} cp`;
        if (qt.q === 0) alerts.push({ level: "warn", text: "Moins d'un quart de comprimé : utiliser une forme plus faiblement dosée ou une solution." });
        else {
          const realMg = qt.q * conc;
          const real = perKg ? realMg / kg / toMg(1, U.num) : realMg / toMg(1, U.num);
          rows.push(["Dose réelle donnée", perKg ? `${fmt(real, 3)} ${c.unit}` : `${fmt(real, 2)} ${U.num}`]);
          if (!cap && !floor && (real < c.min * 0.97 || real > c.max * 1.03)) alerts.push({ level: "warn", text: `Après arrondi au ¼ de comprimé, la dose réelle (${fmt(real, 3)} ${c.unit}) sort de la fourchette. Choisir un autre dosage ou une solution.` });
          if (cap && real > c.max * 1.001) alerts.push({ level: "danger", text: "L'arrondi dépasse le plafond : arrondir à la fraction inférieure." });
        }
        prodLine = `= ${qt.txt} cp de ${fmt(conc, 3)} mg`;
      } else {
        const mgml = cu === "mg/mL" ? conc : cu === "µg/mL" ? conc / 1000 : conc * 10;
        const ml = mg / mgml;
        vol = ml;
        main = fmt(ml, ml < 1 ? 3 : 2);
        mainUnit = "mL";
        sub = `de solution à ${fmt(conc, 3)} ${cu}`;
        if (ml < 0.1) alerts.push({ level: "warn", text: "Volume inférieur à 0,1 mL : diluer ou utiliser une seringue à insuline." });
        prodLine = `= ${fmt(ml, ml < 1 ? 3 : 2)} mL à ${fmt(conc, 3)} ${cu}`;
      }
      rows.unshift([cap ? "Plafond" : "Principe actif", `${fmt(amount, 3)} ${U.num}`]);
    } else {
      main = fmt(amount, 3);
      mainUnit = U.num;
      sub = "Saisir la concentration pour obtenir le volume ou le nombre de comprimés.";
    }
    if (c.perDay && c.perDay > 0) rows.push(["Par jour", `${fmt(amount * c.perDay, 2)} ${U.num} (${c.perDay} prises)`]);
  }
  rows.push(["Voie · rythme", `${c.route} · ${c.frequency}`]);
  const pi = input.productInfo;
  if (pi?.routes?.length) {
    rows.push(["Voie du produit", pi.routes.join(", ")]);
    if (routeMismatch(c.route, pi.routes)) alerts.push({ level: "warn", text: `La recommandation est en ${c.route} ; ce produit s'administre en ${pi.routes.join(", ")} uniquement. Administrez-le par sa voie (${pi.routes.join(", ")}) en vérifiant que la dose reste adaptée, ou choisissez un autre produit.` });
  }
  if (vol > 0 && pi?.components && pi.components.length > 1)
    for (const k of pi.components) rows.push([`Apport ${k.name.toLowerCase()}`, `${fmt(vol * k.mgPerMl, 1)} mg${kg > 0 ? ` (${fmt((vol * k.mgPerMl) / kg, 2)} mg/kg)` : ""}`]);
  if (vol > 0 && pi?.vial && pi.vial.volumeMl > 0) {
    const share = vol / pi.vial.volumeMl;
    if (share <= 1) rows.push(["Part du flacon", `${fmt(vol, 2)} mL sur ${fmt(pi.vial.volumeMl, 1)} mL (${fmt(share * 100, 0)} %)`]);
    else rows.push(["Flacons nécessaires", `${Math.ceil(share)} (${fmt(vol, 1)} mL au total)`]);
    if (share < 1) rows.push(["Reste du flacon", `${fmt(pi.vial.volumeMl - vol, 2)} mL`]);
    if (pi.vial.note) alerts.push({ level: "info", text: pi.vial.note });
  }

  let daTxt = "";
  const sp = speciesOf(species);
  if (sp?.rente) {
    if (vol > 0 && /IM|SC/.test(c.route)) {
      const mx = c.maxSiteMl || sp.maxSiteMl || 5;
      if (vol > mx) {
        const n = Math.ceil(vol / mx);
        rows.push(["Points d'injection", `${n} sites (≤ ${fmt(mx, 1)} mL/site)`]);
        alerts.push({ level: "info", text: `Volume de ${fmt(vol, 1)} mL : répartir sur ${n} sites, ${fmt(mx, 1)} mL maximum par site (vérifier le RCP).` });
      }
    }
    const w = input.withdrawal;
    if (w?.lastDose && w.meatDays != null && w.meatDays >= 0) {
      rows.push(["Viande : fin du délai", addDaysLong(w.lastDose, w.meatDays)]);
      daTxt += `\nDélai viande ${w.meatDays} j → ${addDaysLong(w.lastDose, w.meatDays)}`;
    }
    if (w?.lastDose && w.milkDays != null && w.milkDays >= 0) {
      rows.push(["Lait : fin du délai", addDaysLong(w.lastDose, w.milkDays)]);
      daTxt += `\nDélai lait ${w.milkDays} j → ${addDaysLong(w.lastDose, w.milkDays)}`;
    }
    if (!(w?.meatDays != null && w.meatDays >= 0) && !(w?.milkDays != null && w.milkDays >= 0)) alerts.push({ level: "warn", text: "Animal de rente : reporter les délais d'attente de l'étiquette du produit pour obtenir les dates de fin (ils figurent sur le texte copié)." });
  }

  if (status === "hors_fourchette") alerts.unshift({ level: "warn", text: `Dose saisie hors de la fourchette ${c.min}–${c.max} ${c.unit}. Justifier et vérifier sur le RCP.` });
  if (status === "limite") alerts.unshift({ level: "danger", text: cap ? `Dépasse le plafond de ${fmt(c.max, 3)} ${c.unit}.` : `Sous la dose minimale de ${fmt(c.min, 3)} ${c.unit}.` });
  if (c.alert) alerts.push({ level: c.alert.level, text: c.alert.text });
  alerts.push(...rulesFor(d, species));
  if (d.anecdotal) alerts.push({ level: "info", text: "Dose anecdotique ou extrapolée selon la source." });
  if (input.humanProduct) alerts.push({ level: "warn", text: "Produit à usage humain : usage hors AMM vétérinaire, sous la responsabilité du prescripteur." });
  const blocked = alerts.some((a) => a.block);

  const routeTxt = pi?.routes?.length && routeMismatch(c.route, pi.routes) ? pi.routes.join(", ") : c.route;
  const copy = `${label}\n${fmt(dose, 3)} ${c.unit} ${routeTxt} ${c.frequency}\n${perL ? "" : `→ ${U.num === "mL" ? "" : `${fmt(amount, 3)} ${U.num} `}`}${prodLine}${daTxt}`.trim();
  return { label, main, mainUnit, sub, status, rows, alerts, copy: blocked ? "" : copy, blocked, amount, volumeMl: vol };
}

/** Poids d'un bovin au ruban : 80 × tour de poitrine³ (m), arrondi à 5 kg. */
export const tapeWeight = (chestM: number) => Math.round((80 * chestM ** 3) / 5) * 5;

/** Perfusion continue de lidocaïne (CRI). */
export function lidocaineCri(p: { kg: number; ugKgMin: number; stockMgMl: number; mode: "prep"; bagMl: number; addMl: number } | { kg: number; ugKgMin: number; stockMgMl: number; mode: "rate"; flowMlH: number; bagMl: number }) {
  const mgh = (p.kg * p.ugKgMin * 60) / 1000;
  const rows: [string, string][] = [];
  let main: string;
  let unit: string;
  let sub: string;
  if (p.mode === "prep") {
    const fin = (p.addMl * p.stockMgMl) / (p.bagMl + p.addMl);
    const rate = mgh / fin;
    main = fmt(rate, 1);
    unit = "mL/h";
    sub = `Concentration finale ${fmt(fin, 3)} mg/mL (${fmt(p.addMl * p.stockMgMl, 0)} mg dans ${fmt(p.bagMl + p.addMl, 0)} mL)`;
    rows.push(["Lidocaïne délivrée", `${fmt(mgh, 2)} mg/h`], ["Fluide apporté", `${fmt(rate / p.kg, 2)} mL/kg/h`], ["Durée de la poche", `${fmt((p.bagMl + p.addMl) / rate, 1)} h`]);
  } else {
    const fin = mgh / p.flowMlH;
    const mlAdd = (fin * p.bagMl) / p.stockMgMl;
    main = fmt(mlAdd, 1);
    unit = "mL";
    sub = `de lidocaïne à ${fmt(p.stockMgMl, 0)} mg/mL à ajouter dans la poche de ${fmt(p.bagMl, 0)} mL, puis passer à ${fmt(p.flowMlH, 1)} mL/h`;
    rows.push(["Lidocaïne délivrée", `${fmt(mgh, 2)} mg/h`], ["Concentration visée", `${fmt(fin, 3)} mg/mL`], ["Fluide apporté", `${fmt(p.flowMlH / p.kg, 2)} mL/kg/h`]);
    if (mlAdd > p.bagMl * 0.1) rows.push(["Attention", "volume ajouté > 10 % de la poche"]);
  }
  rows.push(["Bolus 2 mg/kg", `${fmt(p.kg * 2, 1)} mg = ${fmt((p.kg * 2) / p.stockMgMl, 2)} mL`]);
  rows.push(["Par 24 h", `${fmt(mgh * 24, 0)} mg`]);
  return { main, unit, sub, rows };
}

export { familyName };
