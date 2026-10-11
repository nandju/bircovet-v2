import AssistantPage from "@/components/assistant/AssistantPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Assistant IA" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <AssistantPage />;
}
