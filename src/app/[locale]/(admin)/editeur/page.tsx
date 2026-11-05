import PlatformOverview from "@/components/platform/PlatformOverview";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Console éditeur" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <PlatformOverview />;
}
