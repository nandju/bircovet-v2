import ProductDetail from "@/components/stock/ProductDetail";
import { initIdPage, type IdParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Fiche article" };

export default async function Page({ params }: IdParams) {
  const id = await initIdPage(params);
  return <ProductDetail id={id} />;
}
