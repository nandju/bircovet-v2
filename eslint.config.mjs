import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { defineConfig, globalIgnores } from "eslint/config";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "_template-archive/**",
    "scripts/tmp/**",
  ]),
  {
    rules: {
      // Les formulaires des modales de démonstration sont réinitialisés à l'ouverture
      // (pattern "reset on open"), y compris dans les composants du template d'origine.
      "react-hooks/set-state-in-effect": "off",
      // Le store de démonstration (localStorage) synchronise volontairement
      // un ref mutable pendant le rendu du Provider.
      "react-hooks/refs": "off",
    },
  },
]);

export default eslintConfig;
