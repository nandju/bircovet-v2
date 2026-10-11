import EstablishmentsPage from "@/components/admin/EstablishmentsPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Établissements" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <EstablishmentsPage />;
}
