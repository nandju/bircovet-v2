import SuppliersPage from "@/components/purchases/SuppliersPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Fournisseurs" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <SuppliersPage />;
}
