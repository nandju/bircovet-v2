"use client";

import ClivaLogo from "@/components/common/ClivaLogo";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useRouter } from "@/i18n/navigation";
import { EyeCloseIcon, EyeIcon } from "@/icons";
import { DEMO_PASSWORD } from "@/lib/seed/base";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/permissions";
import { cn } from "@/utils";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

export default function SignInForm() {
  const t = useTranslations("auth");
  const { db, user, login } = useDemo();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  const profiles = db.users.filter((u) => u.active);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!email.trim()) errs.email = "L'identifiant (e-mail) est obligatoire.";
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) errs.email = "Format d'e-mail invalide.";
    if (!password) errs.password = "Le mot de passe est obligatoire.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);
    setTimeout(() => {
      const r = login(email, password);
      setLoading(false);
      if (!r.ok) setErrors({ form: r.error });
      else router.replace("/");
    }, 600);
  };

  return (
    <div className="flex w-full flex-1 flex-col overflow-y-auto px-5 py-8 sm:px-8 lg:w-1/2">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <ClivaLogo className="mb-8 lg:hidden" />
        <div className="mb-6">
          <h1 className="mb-1.5 text-title-sm font-semibold text-gray-800 dark:text-white/90">{t("title")}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("subtitle")}</p>
        </div>
        <form onSubmit={submit} noValidate className="space-y-5">
          {errors.form && <div className="rounded-lg border border-error-200 bg-error-25 px-4 py-3 text-sm text-error-700 dark:border-error-800 dark:bg-error-500/10 dark:text-error-300" role="alert">{errors.form}</div>}
          <div>
            <Label htmlFor="login-email">
              Identifiant (e-mail) <span className="text-error-500">*</span>
            </Label>
            <Input id="login-email" type="email" autoComplete="username" placeholder="prenom@cliva.demo" value={email} onChange={(e) => setEmail(e.target.value)} error={!!errors.email} hint={errors.email} />
          </div>
          <div>
            <Label htmlFor="login-password">
              Mot de passe <span className="text-error-500">*</span>
            </Label>
            <div className="relative">
              <Input id="login-password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Votre mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} error={!!errors.password} className="pe-12" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"} className="absolute end-3 top-1/2 z-30 -translate-y-1/2 text-gray-500 dark:text-gray-400">
                {showPassword ? <EyeIcon className="size-5" /> : <EyeCloseIcon className="size-5 fill-current" />}
              </button>
            </div>
            {errors.password && <p className="mt-1.5 text-xs text-error-500">{errors.password}</p>}
          </div>
          <Button type="submit" className="w-full" loading={loading}>
            {loading ? "Connexion…" : "Se connecter"}
          </Button>
        </form>

        <div className="mt-8 rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-white/90">Profils de démonstration</h2>
            <span className="text-theme-xs text-gray-500 dark:text-gray-400">
              Mot de passe commun : <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-gray-700 dark:bg-white/10 dark:text-gray-200">{DEMO_PASSWORD}</code>
            </span>
          </div>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {profiles
              .filter((u, i, arr) => arr.findIndex((x) => x.roleId === u.roleId) === i)
              .map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(u.email);
                      setPassword(DEMO_PASSWORD);
                      setErrors({});
                    }}
                    title={ROLE_DESCRIPTIONS[u.roleId]}
                    className={cn("w-full rounded-xl border px-3 py-2.5 text-start transition hover:border-brand-300 hover:bg-brand-25 dark:hover:bg-brand-500/5", email === u.email ? "border-brand-400 bg-brand-25 dark:border-brand-600 dark:bg-brand-500/10" : "border-gray-200 dark:border-gray-800")}
                  >
                    <span className="block text-sm font-medium text-gray-800 dark:text-white/90">{ROLE_LABELS[u.roleId]}</span>
                    <span className="block truncate text-theme-xs text-gray-500 dark:text-gray-400">{u.email}</span>
                  </button>
                </li>
              ))}
          </ul>
          <p className="mt-3 text-theme-xs text-gray-500 dark:text-gray-400">
            Authentification simulée côté navigateur, sans sécurité serveur. Les restrictions de profils sont une démonstration : les autorisations réelles seront implémentées lors de la phase backend.
          </p>
        </div>
      </div>
    </div>
  );
}
