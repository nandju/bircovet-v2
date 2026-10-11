import { setRequestLocale } from "next-intl/server";

export type LocaleParams = { params: Promise<{ locale: string }> };
export type IdParams = { params: Promise<{ locale: string; id: string }> };

/** À appeler dans chaque page serveur sous [locale] (rendu statique next-intl). */
export async function initPage(params: Promise<{ locale: string }>) {
  const { locale } = await params;
  setRequestLocale(locale);
}

export async function initIdPage(params: Promise<{ locale: string; id: string }>) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return id;
}
