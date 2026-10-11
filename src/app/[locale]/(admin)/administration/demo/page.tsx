import DemoPage from "@/components/admin/DemoPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Environnement de démonstration" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <DemoPage />;
}
