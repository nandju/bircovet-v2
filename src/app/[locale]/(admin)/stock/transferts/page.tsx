import TransfersPage from "@/components/stock/TransfersPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Transferts de stock" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <TransfersPage />;
}
