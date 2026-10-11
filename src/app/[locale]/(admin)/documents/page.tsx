import DocumentsPage from "@/components/documents/DocumentsPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Documents" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <DocumentsPage />;
}
