// ESLint flat config (required by ESLint 9+).
// This replaces the legacy .eslintrc and mirrors its setup: Next.js'
// core-web-vitals rules, Prettier integration, and the unused-imports rule.
import prettierRecommended from "eslint-plugin-prettier/recommended";
import unusedImports from "eslint-plugin-unused-imports";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const config = [
  { ignores: [".next/**", "node_modules/**"] },
  ...nextCoreWebVitals,
  prettierRecommended,
  {
    plugins: { "unused-imports": unusedImports },
    rules: {
      "unused-imports/no-unused-imports": "error",
      // `set-state-in-effect` is a new rule introduced by the React 19-era
      // react-hooks plugin (bundled with eslint-config-next 16). The existing
      // providers intentionally initialize state from browser-only APIs
      // (localStorage, window.location.hash) inside mount effects for SSR
      // safety. Keep it as a warning rather than failing the build.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default config;
