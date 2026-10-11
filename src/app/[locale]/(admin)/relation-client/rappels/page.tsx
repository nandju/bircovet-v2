import RemindersPage from "@/components/crm/RemindersPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Rappels et messages" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <RemindersPage />;
}
