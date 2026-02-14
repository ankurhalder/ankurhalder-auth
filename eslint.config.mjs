import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  
  {
    files: ["src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@app/*", "@infra/*", "@presentation/*"],
              message:
                "Domain layer must not import from Application, Infrastructure, or Presentation.",
            },
            {
              group: ["next/*", "mongodb", "@upstash/*", "@getbrevo/*"],
              message:
                "Domain layer must not depend on framework or infrastructure packages.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/application/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@infra/database/*", "@infra/email/*", "@presentation/*"],
              message:
                "Application layer must not import from Infrastructure (database/email) or Presentation. " +
                "Crypto utilities (@infra/crypto/*) and rate limiters are allowed as shared utilities.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/infrastructure/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@presentation/*"],
              message:
                "Infrastructure layer must not import from Presentation.",
            },
          ],
        },
      ],
    },
  },


  globalIgnores([

    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "scripts/**",
  ]),
]);

export default eslintConfig;
