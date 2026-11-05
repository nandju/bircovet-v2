import CampaignsPage from "@/components/platform/CampaignsPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Campagnes publicitaires" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <CampaignsPage />;
}
