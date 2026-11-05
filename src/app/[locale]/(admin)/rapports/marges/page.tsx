import MarginsPage from "@/components/margins/MarginsPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Marges" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <MarginsPage />;
}
