import MissionDetail from "@/components/missions/MissionDetail";
import { initIdPage, type IdParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mission terrain" };

export default async function Page({ params }: IdParams) {
  const id = await initIdPage(params);
  return <MissionDetail id={id} />;
}
