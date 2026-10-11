import AuditPage from "@/components/admin/AuditPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Journal d'activité" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <AuditPage />;
}
