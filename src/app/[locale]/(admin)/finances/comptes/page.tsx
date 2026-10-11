import AccountsPage from "@/components/finances/AccountsPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Comptes et caisse" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <AccountsPage />;
}
