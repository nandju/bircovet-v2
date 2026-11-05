import StaffPage from "@/components/staff/StaffPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Gestion du personnel" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <StaffPage />;
}
