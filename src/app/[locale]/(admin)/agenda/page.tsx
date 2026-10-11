import AgendaView from "@/components/agenda/AgendaView";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Agenda" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <AgendaView />;
}
