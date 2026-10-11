import PaymentsPage from "@/components/finances/PaymentsPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Encaissements" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <PaymentsPage />;
}
