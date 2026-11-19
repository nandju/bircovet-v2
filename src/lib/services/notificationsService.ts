/**
 * Opérations sur les notifications in-app.
 * Extraite du contexte pour être exposée au registre OPERATIONS : sans cela,
 * « tout marquer lu » n'était appliqué qu'en local et jamais envoyé au serveur.
 */
import { produce, type Service } from "./core";
import { visibleTo } from "../notifications";

/** Marque comme lues toutes les notifications visibles par l'utilisateur courant. */
export const markNotificationsRead: Service<Record<string, never>> = (db, ctx) =>
  produce(db, (d) => {
    for (const n of d.notifications) {
      if (visibleTo(n, ctx.user) && !n.readBy?.includes(ctx.user.id)) {
        n.readBy = [...(n.readBy ?? []), ctx.user.id];
      }
    }
  });
