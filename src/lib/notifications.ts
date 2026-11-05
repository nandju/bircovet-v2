import type { AppNotification, User } from "./types";

/** Une notification sans destinataire est visible par tous ; sinon par les personnes ou rôles ciblés. */
export const visibleTo = (n: AppNotification, u?: User | null) =>
  // L'éditeur de la plateforme ne reçoit jamais les notifications internes d'une clinique.
  !!u && u.roleId !== "editeur" && ((!n.toUserIds?.length && !n.toRoles?.length) || !!n.toUserIds?.includes(u.id) || !!n.toRoles?.includes(u.roleId));

export const isRead = (n: AppNotification, userId?: string) => n.read || (!!userId && !!n.readBy?.includes(userId));
