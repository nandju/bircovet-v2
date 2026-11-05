import MeetingReportsPage from "@/components/reports/MeetingReportsPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Rapports de réunion" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <MeetingReportsPage />;
}
