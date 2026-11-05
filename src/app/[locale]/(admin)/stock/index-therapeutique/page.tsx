import DrugIndexPage from "@/components/drugindex/DrugIndexPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Index thérapeutique" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <DrugIndexPage />;
}
