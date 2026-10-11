import UsersPage from "@/components/admin/UsersPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Utilisateurs" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <UsersPage />;
}
