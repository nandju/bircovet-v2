import { kindMeta, type ActivityKind } from "@/lib/activityKinds";
import { cn } from "@/utils";

/** Pictogrammes au trait, lisibles en petite taille (12–20 px). */
const PATHS: Record<ActivityKind, string> = {
  domicile: "M3 11l9-7 9 7M5 10v10h14V10M10 20v-5h4v5M12 9v3M10.5 10.5h3",
  consultation: "M6 3v5a4 4 0 0 0 8 0V3M10 12v3a4 4 0 0 0 8 0v-2M18 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  vaccination: "M18 2l4 4M20 4l-9.5 9.5M14 6l4 4M7 13l4 4M3 21l3-3M8.5 11.5l4 4-4.5 4.5-4-4z",
  maladie: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.5 2.5M16.5 16.5L19 19M5 19l2.5-2.5M16.5 7.5L19 5",
  alimentation: "M3 11h18a9 9 0 0 1-18 0zM7 7c0-2 2-2 2-4M12 7c0-2 2-2 2-4M17 7c0-2 2-2 2-4",
  chirurgie: "M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.1 8.1L20 20M8.1 15.9L20 4",
  suivi: "M21 12a9 9 0 1 1-3-6.7M21 4v5h-5M9 12l2 2 4-4",
  visite: "M3 21V10l9-6 9 6v11M3 21h18M9 21v-6h6v6M9 10h6",
  mission: "M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  urgence: "M12 3l10 18H2L12 3zM12 10v4M12 17.5v.5",
  rapport: "M6 2h9l5 5v15H6zM14 2v6h6M9 13h8M9 17h6",
};

export default function ActivityIcon({ kind, className, title }: { kind: ActivityKind; className?: string; title?: string }) {
  const m = kindMeta(kind);
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={cn("inline-block size-3.5 shrink-0", m.tone, className)} role="img" aria-label={title ?? m.label}>
      <title>{title ?? m.label}</title>
      <path d={PATHS[kind]} />
    </svg>
  );
}
