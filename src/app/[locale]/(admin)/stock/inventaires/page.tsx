import InventoriesPage from "@/components/stock/InventoriesPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Inventaires" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <InventoriesPage />;
}
