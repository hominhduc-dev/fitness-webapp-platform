import js from "@eslint/js"
import nextPlugin from "eslint-config-next/core-web-vitals"
import globals from "globals"
import tseslint from "typescript-eslint"

const FRONTEND_FILES = ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"]
const BACKEND_FILES = ["backend/src/**/*.ts"]

/**
 * Shared flat configs (Next, typescript-eslint) apply to every file by default.
 * The repo is a monorepo with two very different runtimes, so each shared config
 * is pinned to the half of the tree it actually describes.
 */
function scopeTo(configs, files) {
  return configs.flatMap((config) => {
    // Global-ignore entries carry no rules and must not be given a `files` key.
    if (config.ignores && !config.rules && !config.plugins && !config.languageOptions) {
      return [config]
    }

    return [{ ...config, files }]
  })
}

export default [
  {
    ignores: [
      "**/node_modules/**",
      ".next/**",
      "backend/dist/**",
      "next-env.d.ts",
      "lift-design-system/**",
      "**/*.config.mjs",
    ],
  },

  // ---------------------------------------------------------------- frontend
  ...scopeTo([js.configs.recommended], FRONTEND_FILES),
  ...scopeTo(tseslint.configs.recommended, FRONTEND_FILES),
  ...scopeTo(nextPlugin, FRONTEND_FILES),
  {
    files: FRONTEND_FILES,
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      // Named exports only — see CLAUDE.md ground rule 4.
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportDefaultDeclaration",
          message:
            "Frontend components use named exports (CLAUDE.md ground rule 4). Next.js route files are exempt via an override.",
        },
      ],
    },
  },
  {
    files: FRONTEND_FILES,
    rules: {
      // React Compiler rules shipped with Next 16's react-hooks plugin. The existing
      // components predate them (~40 hits, mostly effects that reset derived state).
      // They stay at `warn` so CI is a meaningful gate today; see docs/tech-debt.md
      // for the burn-down plan before promoting them to `error`.
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    // Next.js requires default exports for pages, layouts, error boundaries and route handlers.
    files: [
      "app/**/page.tsx",
      "app/**/layout.tsx",
      "app/**/loading.tsx",
      "app/**/error.tsx",
      "app/**/not-found.tsx",
      "app/**/template.tsx",
      "app/**/route.ts",
      "app/**/opengraph-image.tsx",
      "app/**/icon.tsx",
      "app/**/apple-icon.tsx",
      "app/**/sitemap.ts",
      "app/**/robots.ts",
      "app/**/manifest.ts",
    ],
    rules: {
      "no-restricted-syntax": "off",
    },
  },

  // ----------------------------------------------------------------- backend
  ...scopeTo([js.configs.recommended], BACKEND_FILES),
  ...scopeTo(tseslint.configs.recommended, BACKEND_FILES),
  {
    files: BACKEND_FILES,
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        project: "./backend/tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Raw Error throws bypass the AppError -> HTTP status mapping (CLAUDE.md ground rule 2).
      "no-restricted-syntax": [
        "error",
        {
          selector: "ThrowStatement > NewExpression[callee.name='Error']",
          message: "Throw an AppError subclass instead of a raw Error (CLAUDE.md ground rule 2).",
        },
      ],
    },
  },
  // ------------------------------------------------------------------ shared
  {
    files: [...FRONTEND_FILES, ...BACKEND_FILES],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          // `const { omitted, ...rest } = obj` is the idiomatic way to drop a field.
          ignoreRestSiblings: true,
          varsIgnorePattern: "^_",
        },
      ],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "smart"],
      "prefer-const": "error",
    },
  },
  {
    // The backend has a structured logger; console output would bypass request ids
    // and the JSON format the production log shipper expects.
    files: BACKEND_FILES,
    rules: {
      "no-console": "error",
    },
  },
  {
    // Tests must be able to construct the failure modes they assert on — including
    // the raw Error that the central handler is supposed to treat as an opaque 500.
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  {
    // Bootstrap and CLI code runs outside a request: env validation reports before the
    // logger is constructed, the logger itself is the console sink, and the seed/admin
    // scripts are operator-facing terminal tools.
    files: ["backend/src/config/**/*.ts", "backend/src/lib/logger.ts", "backend/src/scripts/**/*.ts"],
    rules: {
      "no-console": "off",
      "no-restricted-syntax": "off",
    },
  },
]
