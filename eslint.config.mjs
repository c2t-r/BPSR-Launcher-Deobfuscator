import eslint from "@eslint/js";
import importX from "eslint-plugin-import-x";
import tseslint from "typescript-eslint";


export default tseslint.config(
  eslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
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

      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "class",
          format: ["StrictPascalCase"],
        },
        {
          selector: "property",
          format: ["StrictPascalCase", "strictCamelCase"],
        },
        {
          selector: ["variable", "parameter", "class", "property"],
          format: ["strictCamelCase"],
        },
      ],
    },
  },
);
