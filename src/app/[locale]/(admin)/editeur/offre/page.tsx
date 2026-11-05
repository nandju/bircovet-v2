import OfferPage from "@/components/platform/OfferPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Offre Cliva" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <OfferPage />;
}
