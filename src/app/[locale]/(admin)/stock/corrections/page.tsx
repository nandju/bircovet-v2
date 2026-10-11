import CorrectionsPage from "@/components/stock/CorrectionsPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Pertes et corrections" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <CorrectionsPage />;
}
