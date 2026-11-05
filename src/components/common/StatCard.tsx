import { Link } from "@/i18n/navigation";
import { ArrowDownIcon, ArrowUpIcon } from "@/icons";
import { cn } from "@/utils";

type Tone = "brand" | "tertiary" | "secondary" | "warning" | "error";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  tone?: Tone;
  delta?: { value: number; label: string; positiveIsGood?: boolean };
  hint?: string;
  href?: string;
  /** Carte mise en avant, en dégradé (couleur de l'univers). */
  featured?: "brand" | "rural" | "gestion" | "agenda";
}

const TONES: Record<Tone, string> = {
  brand: "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300",
  tertiary: "bg-tertiary-50 text-tertiary-600 dark:bg-tertiary-500/15 dark:text-tertiary-300",
  secondary: "bg-secondary-50 text-secondary-700 dark:bg-secondary-500/15 dark:text-secondary-300",
  warning: "bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400",
  error: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400",
};

/** Carte KPI : icône, valeur, libellé, comparaison avec la période précédente. */
const FEATURED = { brand: "cliva-grad-brand", rural: "cliva-grad-rural", gestion: "cliva-grad-gestion", agenda: "cliva-grad-agenda" } as const;

export default function StatCard({ label, value, icon, tone = "brand", delta, hint, href, featured }: StatCardProps) {
  const good = delta ? (delta.positiveIsGood ?? true) === delta.value >= 0 : true;
  const f = !!featured;
  const body = (
    <div className={cn("flex h-full flex-col justify-between gap-3 rounded-3xl p-4 transition duration-300 hover:-translate-y-0.5 sm:p-5", f ? cn("cliva-glow text-white shadow-cliva hover:shadow-theme-lg", FEATURED[featured!]) : "border border-gray-200/70 bg-white shadow-cliva hover:shadow-theme-md dark:border-gray-800 dark:bg-white/3")}>
      <div className="flex items-start justify-between gap-3">
        <p className={cn("text-sm", f ? "text-white/80" : "text-gray-500 dark:text-gray-400")}>{label}</p>
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full [&>svg]:size-5", f ? "bg-white/20 text-white ring-1 ring-white/25" : TONES[tone])}>{icon}</span>
      </div>
      <div>
        <p className={cn("text-xl leading-tight font-semibold tracking-tight tabular-nums [overflow-wrap:anywhere] sm:text-3xl", f ? "text-white" : "text-gray-800 dark:text-white/90")}>{value}</p>
        {delta ? (
          <p className={cn("mt-1 flex flex-wrap items-center gap-1 text-theme-xs", f ? "text-white/80" : "text-gray-500 dark:text-gray-400")}>
            <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium", good ? "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400" : "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-400")}>
              {delta.value >= 0 ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />}
              {Math.abs(delta.value).toFixed(0)} %
            </span>
            {delta.label}
          </p>
        ) : (
          hint && <p className={cn("mt-1 text-theme-xs", f ? "text-white/75" : "text-gray-500 dark:text-gray-400")}>{hint}</p>
        )}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}
