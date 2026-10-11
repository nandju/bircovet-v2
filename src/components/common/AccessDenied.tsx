import { Link } from "@/i18n/navigation";
import { LockIcon } from "@/icons";

export default function AccessDenied({ what }: { what?: string }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center dark:border-gray-800 dark:bg-white/3">
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-warning-50 text-warning-600 dark:bg-warning-500/15 [&>svg]:size-6">
        <LockIcon />
      </span>
      <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">Accès non autorisé pour ce profil</h2>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        {what ? `${what} n'est pas accessible` : "Cet espace n'est pas accessible"} avec le profil de démonstration actif. Ces restrictions sont une
        simulation frontend : les autorisations réelles seront appliquées côté serveur.
      </p>
      <Link href="/" className="mt-5 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
        Retour à la vue d&apos;ensemble
      </Link>
    </div>
  );
}
