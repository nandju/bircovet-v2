import QueueBoard from "@/components/agenda/QueueBoard";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "File d'attente" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <QueueBoard />;
}
