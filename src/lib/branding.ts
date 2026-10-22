import type { Branding } from "./types";

/**
 * Personnalisation visuelle de la plateforme (mini-moteur de thème).
 * Les couleurs sont appliquées via les variables CSS du thème Tailwind v4
 * (`--color-brand-*`, `--color-secondary-*`, `--color-tertiary-*`) générées
 * par mélange — aucune couleur n'est codée en dur dans les composants.
 * Point d'intégration backend : `branding` est porté par `settings` (organisation).
 */

/** Identité par défaut : reprend la palette et l'identité actuelles du projet. */
export const DEFAULT_BRANDING: Branding = {
  platformName: "Cliva",
  slogan: "Cliva — la clinique vétérinaire qui avance avec vous.",
  logoDataUrl: "",
  colors: { primary: "#04A154", secondary: "#6AB391", tertiary: "#019CC8" },
  font: "outfit",
};

export const FONT_OPTIONS: { value: Branding["font"]; label: string; css: string }[] = [
  { value: "outfit", label: "Outfit (défaut)", css: "var(--font-outfit)" },
  { value: "inter", label: "Inter", css: "var(--font-inter)" },
  { value: "dm-sans", label: "DM Sans", css: "var(--font-dm-sans)" },
  { value: "system", label: "Système", css: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");

/** Mélange base vers une couleur cible (0 = base, 1 = cible). */
function mix(hex: string, target: [number, number, number], t: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `#${toHex(r + (target[0] - r) * t)}${toHex(g + (target[1] - g) * t)}${toHex(b + (target[2] - b) * t)}`;
}

const WHITE: [number, number, number] = [255, 255, 255];
const BLACK: [number, number, number] = [0, 0, 0];

/** Génère l'échelle 25–950 d'un canal à partir de la teinte 500. */
export function palette(hex: string): Record<string, string> {
  return {
    25: mix(hex, WHITE, 0.95),
    50: mix(hex, WHITE, 0.9),
    100: mix(hex, WHITE, 0.78),
    200: mix(hex, WHITE, 0.62),
    300: mix(hex, WHITE, 0.42),
    400: mix(hex, WHITE, 0.18),
    500: hex.toLowerCase().replace(/^#+/, "#"),
    600: mix(hex, BLACK, 0.14),
    700: mix(hex, BLACK, 0.3),
    800: mix(hex, BLACK, 0.45),
    900: mix(hex, BLACK, 0.56),
    950: mix(hex, BLACK, 0.72),
  };
}

/** Luminance relative WCAG d'une couleur hexadécimale. */
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export const isValidHex = (v: string) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v.trim());

const CHANNELS: { key: "primary" | "secondary" | "tertiary"; varName: string }[] = [
  { key: "primary", varName: "--color-brand" },
  { key: "secondary", varName: "--color-secondary" },
  { key: "tertiary", varName: "--color-tertiary" },
];

/**
 * Applique l'identité visuelle sur `document.documentElement` (navigateur uniquement).
 * Ne modifie aucun fichier du projet : la personnalisation vit dans les paramètres.
 */
export function applyBranding(branding: Branding | undefined) {
  if (typeof document === "undefined") return;
  const b = { ...DEFAULT_BRANDING, ...branding, colors: { ...DEFAULT_BRANDING.colors, ...branding?.colors } };
  const root = document.documentElement;
  for (const ch of CHANNELS) {
    const scale = palette(isValidHex(b.colors[ch.key]) ? b.colors[ch.key] : DEFAULT_BRANDING.colors[ch.key]);
    for (const [shade, value] of Object.entries(scale)) root.style.setProperty(`${ch.varName}-${shade}`, value);
  }
  const font = FONT_OPTIONS.find((f) => f.value === b.font) ?? FONT_OPTIONS[0];
  document.body.style.fontFamily = font.css;
  root.dataset.brandingFont = b.font;
}

/** Réinitialise les variables aux valeurs du thème compilé (supprime les surcharges). */
export function clearBrandingOverrides() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const ch of CHANNELS) for (const s of ["25", "50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"]) root.style.removeProperty(`${ch.varName}-${s}`);
  document.body.style.fontFamily = "";
  delete root.dataset.brandingFont;
}
