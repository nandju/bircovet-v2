import FollowUpPage from "@/components/crm/followup/FollowUpPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Suivi client" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <FollowUpPage />;
}
