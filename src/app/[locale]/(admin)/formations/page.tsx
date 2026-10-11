import TrainingsPage from "@/components/trainings/TrainingsPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Formations" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <TrainingsPage />;
}
