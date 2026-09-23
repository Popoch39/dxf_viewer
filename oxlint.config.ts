import { defineConfig } from "oxlint";

export default defineConfig({
  plugins: ["eslint", "typescript", "unicorn", "oxc", "import", "react", "jsx-a11y"],
  categories: {
    correctness: "error",
    suspicious: "error",
    perf: "error",
    pedantic: "warn",
  },
  options: {
    typeAware: true,
    reportUnusedDisableDirectives: "error",
  },
  env: {
    browser: true,
    node: true,
  },
  ignorePatterns: [
    ".agent/**",
    ".agents/**",
    ".claude/**",
    ".codex/**",
    ".continue/**",
    ".cursor/**",
    ".gemini/**",
    ".opencode/**",
    ".pi/**",
    ".roo/**",
    ".windsurf/**",
    "tools/oxlint/anti-slop/**",
    "**/dist/**",
    "**/out/**",
  ],
  jsPlugins: [{ name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" }],
  rules: {
    // Automatic JSX runtime (React 19): React does not need to be in scope.
    "react/react-in-jsx-scope": "off",
    // Keeps Vite fast refresh working.
    "react/only-export-components": ["warn", { allowConstantExport: true }],
    "import/no-unassigned-import": ["error", { allow: ["**/*.css"] }],
    // Library types (ReactNode, ReactElement) can never be deeply readonly.
    "typescript/prefer-readonly-parameter-types": [
      "warn",
      { allow: [{ from: "package", package: "react", name: ["ReactNode", "ReactElement"] }] },
    ],
    "oxc/no-accumulating-spread": "error",
    "anti-slop/no-array-filter-map": "error",
    "anti-slop/no-reduce-accumulator-copy": "error",
    "anti-slop/no-chained-type-assertions": "error",
    "anti-slop/no-conditional-empty-object-spread": "error",
    "anti-slop/no-known-value-widening": "error",
    "anti-slop/no-module-mocking": "error",
    "anti-slop/no-object-parameters": "error",
    "anti-slop/no-reflect-apply": "error",
    "anti-slop/no-reflect-get": "error",
    "anti-slop/no-runtime-typeof": "error",
    "anti-slop/no-shape-in-symbol-names": "error",
    "anti-slop/no-unknown-parameters": "error",
    "anti-slop/no-unknown-returns": "error",
    "anti-slop/no-unknown-type-aliases": "error",
    "anti-slop/no-unsafe-dictionary-type": "error",
    "anti-slop/no-widen-then-assert": "error",
    "anti-slop/require-readable-spacing": "error",
    "anti-slop/require-safety-comment-for-type-assertion": "error",
  },
});
