// ESLint flat config de l'API NestJS (projet séparé : le lint racine
// ignore apps/**). Analyse seule — pas de type-checking (cf. pnpm typecheck).
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "src/generated/**", "coverage/**", "*.config.*"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Convention du projet : le préfixe « _ » marque une variable
      // volontairement ignorée (ex. exclusion de champs sensibles).
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
);
