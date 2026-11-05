import { cn } from "@/utils";

/** Pictogramme d'espèce (emoji système : aucun fichier à charger). */
const MAP: [RegExp, string][] = [
  [/chien|canin/i, "🐕"],
  [/chat|f[ée]lin/i, "🐈"],
  [/volaill|poule|poulet|pondeu|chair|caille|dinde/i, "🐔"],
  [/pintade/i, "🐦"],
  [/canard|oie/i, "🦆"],
  [/bovin|z[ée]bu|vache|veau|taur/i, "🐄"],
  [/ovin|mouton|brebis|b[ée]lier/i, "🐑"],
  [/caprin|ch[èe]vre|bouc/i, "🐐"],
  [/porc|truie|porcelet/i, "🐖"],
  [/lapin/i, "🐇"],
  [/poisson|tilapia|silure|clarias|piscic/i, "🐟"],
  [/cheval|[ée]quid|[âa]ne/i, "🐎"],
  [/oiseau|perroquet|nac/i, "🦜"],
  [/rongeur|hamster|cobaye/i, "🐹"],
  [/tortue|reptile/i, "🐢"],
  [/abeille/i, "🐝"],
];

export const speciesEmoji = (species?: string) => MAP.find(([re]) => re.test(species ?? ""))?.[1] ?? "🐾";

export default function SpeciesIcon({ species, className, withLabel = false }: { species?: string; className?: string; withLabel?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap", className)} title={species}>
      <span aria-hidden className="text-[1.1em] leading-none">{speciesEmoji(species)}</span>
      {withLabel && <span>{species}</span>}
    </span>
  );
}
