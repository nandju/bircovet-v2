import { Link } from "@/i18n/navigation";
import { ChevronLeftIcon } from "@/icons";

interface BreadcrumbProps {
  pageTitle: string;
  subtitle?: string;
  trail?: { label: string; href: string }[];
  actions?: React.ReactNode;
}

const Chevron = () => <ChevronLeftIcon className="size-3.5 rotate-180 rtl:rotate-0" />;

const PageBreadcrumb: React.FC<BreadcrumbProps> = ({ pageTitle, subtitle, trail = [], actions }) => {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <nav aria-label="Fil d'Ariane" className="mb-1.5">
          <ol className="flex flex-wrap items-center gap-1 text-theme-xs text-gray-500 dark:text-gray-400">
            <li>
              <Link className="inline-flex items-center gap-1 hover:text-brand-600" href="/">
                Accueil
                <Chevron />
              </Link>
            </li>
            {trail.map((t) => (
              <li key={t.href}>
                <Link className="inline-flex items-center gap-1 hover:text-brand-600" href={t.href}>
                  {t.label}
                  <Chevron />
                </Link>
              </li>
            ))}
            <li className="max-w-[60vw] truncate text-gray-700 dark:text-white/80">{pageTitle}</li>
          </ol>
        </nav>
        <h1 className="truncate text-xl font-semibold text-gray-800 dark:text-white/90">{pageTitle}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 print:hidden">{actions}</div>}
    </div>
  );
};

export default PageBreadcrumb;
