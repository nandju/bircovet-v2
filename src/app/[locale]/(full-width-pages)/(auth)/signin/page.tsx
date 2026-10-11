import SignInForm from "@/components/auth/SignInForm";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

export const metadata: Metadata = {
  title: "Connexion",
  description: "Connexion à la plateforme BIRCOVET (démonstration).",
};

export default async function SignIn({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SignInForm />;
}
