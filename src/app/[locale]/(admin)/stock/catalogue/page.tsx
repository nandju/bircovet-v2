import Catalog from "@/components/stock/Catalog";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Catalogue des articles" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <Catalog />;
}
