import { FolderIcon } from "@/icons";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

export default function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 px-6 py-10 text-center dark:border-gray-800">
      <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-500 dark:bg-brand-500/10 [&>svg]:size-6">{icon ?? <FolderIcon />}</span>
      <p className="text-sm font-medium text-gray-800 dark:text-white/90">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
