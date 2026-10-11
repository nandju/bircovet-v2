import TasksPage from "@/components/crm/TasksPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Tâches et suivis" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <TasksPage />;
}
