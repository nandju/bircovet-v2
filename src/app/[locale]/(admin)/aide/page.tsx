import HelpCenter from "@/components/help/HelpCenter";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Centre d'aide" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <HelpCenter />;
}
