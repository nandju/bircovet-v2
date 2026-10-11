import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fr"], // BIRCOVET : interface en français (fr-FR / Côte d'Ivoire)
  defaultLocale: "fr",
  localePrefix: "never",
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
