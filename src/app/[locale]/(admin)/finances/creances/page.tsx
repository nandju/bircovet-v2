import ReceivablesPage from "@/components/finances/ReceivablesPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Créances" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <ReceivablesPage />;
}
