"use client";

import AppModal from "@/components/common/AppModal";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useRouter } from "@/i18n/navigation";
import { useEffect, useState } from "react";

const STEPS = [
  { emoji: "👋", title: "Bienvenue sur Cliva", text: "Cliva rassemble l'agenda, les dossiers des animaux, la pharmacie, la caisse et les élevages. Voici 3 repères pour vous lancer." },
  { emoji: "＋", title: "« Que voulez-vous faire ? »", text: "Le bouton vert en haut. Touchez-le et choisissez la tâche en mots simples : donner un rendez-vous, vendre un produit, noter une dépense…" },
  { emoji: "?", title: "Le bouton « Aide »", text: "Sur chaque page, il explique à quoi sert l'écran, étape par étape, avec la vidéo qui va avec." },
  { emoji: "🔴", title: "Les pastilles rouges", text: "Dans le menu de gauche, une pastille rouge indique ce qui vous attend (demandes de rendez-vous, dépenses sans preuve…)." },
];

/** Accueil guidé, montré une fois par utilisateur et par appareil. */
export default function WelcomeTour() {
  const { user } = useDemo();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(false);
  const key = user ? `cliva.welcome.${user.id}` : "";
  useEffect(() => {
    if (!key) return;
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- affichage unique, mémorisé sur l'appareil
      if (!localStorage.getItem(key)) setOpen(true);
    } catch {
      /* stockage indisponible : pas d'accueil */
    }
  }, [key]);
  const done = () => {
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* rien */
    }
    setOpen(false);
  };
  if (!open) return null;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;
  return (
    <AppModal
      isOpen
      onClose={done}
      title={`${step + 1} / ${STEPS.length}`}
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={done}>Passer</Button>
          {step > 0 && <Button size="sm" variant="outline" onClick={() => setStep(step - 1)}>Précédent</Button>}
          {last ? (
            <>
              <Button size="sm" variant="outline" onClick={() => { done(); router.push("/aide"); }}>Voir les tutoriels</Button>
              <Button size="sm" onClick={done}>Commencer</Button>
            </>
          ) : (
            <Button size="sm" onClick={() => setStep(step + 1)}>Suivant</Button>
          )}
        </>
      }
    >
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <span aria-hidden className="cliva-grad-brand flex size-16 items-center justify-center rounded-2xl text-3xl font-bold text-white">{s.emoji}</span>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{s.title}</h3>
        <p className="max-w-md text-base text-gray-600 dark:text-gray-400">{s.text}</p>
        <div className="flex gap-1.5" aria-hidden>
          {STEPS.map((_, i) => <span key={i} className={i === step ? "h-1.5 w-6 rounded-full bg-brand-500" : "size-1.5 rounded-full bg-gray-300 dark:bg-gray-600"} />)}
        </div>
      </div>
    </AppModal>
  );
}
