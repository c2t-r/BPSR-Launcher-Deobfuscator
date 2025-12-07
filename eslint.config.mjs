import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import importX from "eslint-plugin-import-x";
import globals from "globals";


export default defineConfig(
  eslint.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: 'script',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.node
      }
    },
    plugins: {
      "import-x": importX,
    },
    rules: {
      "no-unexpected-multiline": "error",
      "no-unreachable": "error",

      "import-x/order": [
        "error",
        {
          alphabetize: { order: "asc" },
          groups: ["builtin", "external", "internal", ["parent", "sibling", "index"], "type"],
          "newlines-between": "always",
        },
      ],
    },
  },
);
