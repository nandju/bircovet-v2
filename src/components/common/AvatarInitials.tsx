import { initials } from "@/lib/format";
import { cn } from "@/utils";

const TONES = [
  "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300",
  "bg-tertiary-100 text-tertiary-700 dark:bg-tertiary-500/20 dark:text-tertiary-300",
  "bg-secondary-100 text-secondary-800 dark:bg-secondary-500/20 dark:text-secondary-300",
  "bg-warning-100 text-warning-700 dark:bg-warning-500/20 dark:text-warning-300",
];

export default function AvatarInitials({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const tone = TONES[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % TONES.length];
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", tone, size === "sm" ? "size-8 text-xs" : size === "lg" ? "size-14 text-lg" : "size-10 text-sm lg:size-11")}>
      {initials(name)}
    </span>
  );
}
