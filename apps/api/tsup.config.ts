import { defineConfig } from "tsup";

// Build de production : un seul bundle dist/main.js.
// - format "esm" : le client Prisma généré utilise import.meta.url, qui ne
//   fonctionne pas en CommonJS — d'où le format ESM (package.json "type": "module").
// - noExternal @cliva/core : le paquet partagé est du TypeScript source,
//   il doit être compilé DANS le bundle (les autres dépendances restent
//   externes dans node_modules).
export default defineConfig({
  entry: { main: "src/main.ts" },
  format: ["esm"],
  outDir: "dist",
  sourcemap: true,
  clean: true,
  noExternal: ["@cliva/core"],
  // Certaines dépendances internes utilisent require() : on le recrée pour l'ESM.
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
});
