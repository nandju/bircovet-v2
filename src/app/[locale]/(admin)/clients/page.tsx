import ClientsList from "@/components/clients/ClientsList";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Clients" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <ClientsList />;
}
