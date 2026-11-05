import TeamTasksPage from "@/components/team/TeamTasksPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Tâches de l'équipe" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <TeamTasksPage />;
}
