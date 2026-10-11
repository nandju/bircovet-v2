import ReceptionsPage from "@/components/purchases/ReceptionsPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Réceptions" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <ReceptionsPage />;
}
