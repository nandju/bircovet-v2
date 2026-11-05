import ProjectsPage from "@/components/projects/ProjectsPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Projets" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <ProjectsPage />;
}
