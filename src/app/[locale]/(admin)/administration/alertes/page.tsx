import AlertsSettingsPage from "@/components/admin/AlertsSettingsPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Alertes et notifications" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <AlertsSettingsPage />;
}
