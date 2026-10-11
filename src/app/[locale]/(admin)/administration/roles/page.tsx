import RolesPage from "@/components/admin/RolesPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Rôles et permissions" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <RolesPage />;
}
