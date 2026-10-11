import ClientForm from "@/components/clients/ClientForm";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Nouveau client" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <ClientForm />;
}
