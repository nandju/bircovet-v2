import Badge from "@/components/ui/badge/Badge";
import { labelOf, STATUS, type LabelMap, type StatusKind } from "@/lib/labels";

interface StatusBadgeProps {
  kind: StatusKind;
  value: string | undefined | null;
  size?: "sm" | "md";
}

export default function StatusBadge({ kind, value, size = "sm" }: StatusBadgeProps) {
  if (value == null) return <span className="text-gray-400">—</span>;
  const s = (STATUS[kind] as LabelMap)[value];
  return (
    <Badge size={size} color={s?.tone ?? "light"}>
      {labelOf(kind, value)}
    </Badge>
  );
}
