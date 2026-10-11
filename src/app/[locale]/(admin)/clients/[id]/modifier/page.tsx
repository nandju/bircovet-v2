import ClientForm from "@/components/clients/ClientForm";
import { initIdPage, type IdParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Modifier un client" };

export default async function Page({ params }: IdParams) {
  const id = await initIdPage(params);
  return <ClientForm clientId={id} />;
}
