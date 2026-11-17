// Marque une route (ou un contrôleur entier) comme publique :
// le guard JWT global laissera passer la requête sans jeton.
import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
