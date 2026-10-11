import { useDemo } from "@/context/DemoStoreContext";
import { Link } from "@/i18n/navigation";
import { ROLE_LABELS } from "@/lib/permissions";
import { useTranslations } from "next-intl";

export default function SidebarWidget() {
  const t = useTranslations("sidebar.demoWidget");
  const { user } = useDemo();

  return (
    <div className="mt-auto rounded-2xl border border-brand-100 bg-brand-25 px-4 py-4 dark:border-brand-500/20 dark:bg-brand-500/5">
      <h3 className="text-sm font-semibold text-brand-800 dark:text-brand-300">{t("title")}</h3>
      <p className="mt-1 text-theme-xs text-gray-600 dark:text-gray-400">{t("text")}</p>
      {user && <p className="mt-2 text-theme-xs font-medium text-tertiary-700 dark:text-tertiary-300">Profil : {ROLE_LABELS[user.roleId]}</p>}
      <Link href="/administration/demo" className="mt-3 flex items-center justify-center rounded-lg bg-brand-500 p-2.5 text-theme-sm font-medium text-white hover:bg-brand-600">
        {t("cta")}
      </Link>
    </div>
  );
}
