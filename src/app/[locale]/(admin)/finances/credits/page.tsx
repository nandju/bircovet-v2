import CreditsPage from "@/components/finances/CreditsPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Crédits" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <CreditsPage />;
}
