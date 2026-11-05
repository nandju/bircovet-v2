import ProtocolsPage from "@/components/protocols/ProtocolsPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Protocoles et fiches" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <ProtocolsPage />;
}
