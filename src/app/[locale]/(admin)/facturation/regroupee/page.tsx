import GroupedBillingPage from "@/components/billing/GroupedBillingPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Facturation regroupée" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <GroupedBillingPage />;
}
