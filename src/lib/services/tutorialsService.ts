import { isHttpUrl } from "../protocols";
import { DEFAULT_TUTORIALS } from "../tutorials";
import { uid } from "../format";
import type { Tutorial } from "../types";
import { audit, fail, must, produce, type Service } from "./core";

const list = (d: { tutorials?: Tutorial[] }) => (d.tutorials = d.tutorials ?? structuredClone(DEFAULT_TUTORIALS));

/** Le DG colle le lien YouTube ou Drive de la vidéo. */
export const setTutorialVideo: Service<{ id: string; url: string }> = (db, ctx, { id, url }) =>
  produce(db, (d) => {
    if (ctx.user.roleId !== "dg") fail("Seul le DG gère les vidéos du Centre d'aide.");
    if (url.trim() && !isHttpUrl(url)) fail("Lien invalide : collez le lien complet de la vidéo (https://youtu.be/… ou https://drive.google.com/…).");
    const t = must(list(d).find((x) => x.id === id), "Tutoriel introuvable.");
    t.videoUrl = url.trim() || undefined;
    audit(d, ctx, { module: "Aide", action: "Vidéo de tutoriel", target: t.title });
    return { message: url.trim() ? "Vidéo enregistrée : toute l'équipe peut la regarder." : "Lien retiré." };
  });

export const saveTutorial: Service<{ id?: string; title: string; theme: string; minutes: number; audience: string; videoUrl?: string; routes: string[]; script: { show: string; say: string }[] }, string> = (db, ctx, input) =>
  produce(db, (d) => {
    if (ctx.user.roleId !== "dg") fail("Seul le DG gère les tutoriels.");
    if (!input.title.trim()) fail("Titre requis.");
    if (input.videoUrl && !isHttpUrl(input.videoUrl)) fail("Lien de vidéo invalide.");
    const clean = { ...input, title: input.title.trim(), theme: input.theme.trim() || "Autres", script: input.script.filter((s) => s.show.trim() || s.say.trim()), videoUrl: input.videoUrl?.trim() || undefined };
    const all = list(d);
    if (input.id) {
      const t = must(all.find((x) => x.id === input.id));
      Object.assign(t, clean);
      return { message: "Tutoriel mis à jour.", data: t.id };
    }
    const id = uid("tuto");
    all.push({ ...clean, id });
    return { message: "Tutoriel ajouté.", data: id };
  });

export const markTutorialSeen: Service<{ id: string; seen: boolean }> = (db, ctx, { id, seen }) =>
  produce(db, (d) => {
    const t = must(list(d).find((x) => x.id === id));
    const s = new Set(t.seenBy ?? []);
    if (seen) s.add(ctx.user.id);
    else s.delete(ctx.user.id);
    t.seenBy = [...s];
    return { message: seen ? "Marqué comme vu." : "Marqué comme à revoir." };
  });
