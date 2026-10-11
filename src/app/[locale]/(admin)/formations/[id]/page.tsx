import SessionDetail from "@/components/trainings/SessionDetail";
import { initIdPage, type IdParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Session de formation" };

export default async function Page({ params }: IdParams) {
  const id = await initIdPage(params);
  return <SessionDetail id={id} />;
}
