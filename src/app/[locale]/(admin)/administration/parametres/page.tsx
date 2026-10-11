import SettingsPage from "@/components/admin/SettingsPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Paramètres" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <SettingsPage />;
}
