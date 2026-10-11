import PurchaseOrdersPage from "@/components/purchases/PurchaseOrdersPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Commandes d'achat" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <PurchaseOrdersPage />;
}
