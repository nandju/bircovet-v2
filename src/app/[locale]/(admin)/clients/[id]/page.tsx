import ClientDetail from "@/components/clients/ClientDetail";
import { initIdPage, type IdParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Fiche client" };

export default async function Page({ params }: IdParams) {
  const id = await initIdPage(params);
  return <ClientDetail id={id} />;
}
