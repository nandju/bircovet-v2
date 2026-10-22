import TeamPage from "@/components/team/TeamPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Espace équipe" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <TeamPage />;
}
