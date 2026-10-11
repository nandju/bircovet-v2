import Dashboard from "@/components/dashboard/Dashboard";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Vue d'ensemble" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <Dashboard />;
}
