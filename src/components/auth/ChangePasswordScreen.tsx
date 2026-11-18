"use client";

/**
 * Écran bloquant affiché en mode connecté (API) quand le compte a
 * mustChangePassword = true : l'utilisateur doit définir son propre mot de
 * passe avant d'accéder à l'application.
 */
import ClivaLogo from "@/components/common/ClivaLogo";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { apiChangePassword } from "@/lib/api";
import { useState } from "react";

export default function ChangePasswordScreen({ onDone }: { onDone: () => void }) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 10) return setError("Le nouveau mot de passe doit contenir au moins 10 caractères.");
    if (newPassword !== confirm) return setError("La confirmation ne correspond pas au nouveau mot de passe.");
    setError(null);
    setLoading(true);
    try {
      await apiChangePassword(oldPassword, newPassword);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Changement impossible.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 px-5 dark:bg-gray-900">
      <ClivaLogo />
      <form onSubmit={submit} noValidate className="w-full max-w-md space-y-5 rounded-3xl border border-gray-200 bg-white p-6 shadow-cliva dark:border-gray-800 dark:bg-white/3">
        <div>
          <h1 className="text-title-sm font-semibold text-gray-800 dark:text-white/90">Nouveau mot de passe requis</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Pour sécuriser votre compte, choisissez votre propre mot de passe (10 caractères minimum).</p>
        </div>
        {error && <div className="rounded-lg border border-error-200 bg-error-25 px-4 py-3 text-sm text-error-700 dark:border-error-800 dark:bg-error-500/10 dark:text-error-300" role="alert">{error}</div>}
        <div>
          <Label htmlFor="cp-old">Mot de passe actuel <span className="text-error-500">*</span></Label>
          <Input id="cp-old" type="password" autoComplete="current-password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="cp-new">Nouveau mot de passe <span className="text-error-500">*</span></Label>
          <Input id="cp-new" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="cp-confirm">Confirmer le nouveau mot de passe <span className="text-error-500">*</span></Label>
          <Input id="cp-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" loading={loading}>{loading ? "Enregistrement…" : "Enregistrer le mot de passe"}</Button>
      </form>
    </div>
  );
}
