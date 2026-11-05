import MoleculeIndex from "@/components/pharma/MoleculeIndex";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Index des molécules" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <MoleculeIndex />;
}
