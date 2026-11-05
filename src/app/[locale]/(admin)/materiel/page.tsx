import EquipmentPage from "@/components/equipment/EquipmentPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Matériel et équipements" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <EquipmentPage />;
}
