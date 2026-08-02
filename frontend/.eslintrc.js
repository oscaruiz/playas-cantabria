// Architecture boundaries. Documented in plans/beach-discovery-frontend-architecture.md;
// enforced here so they cannot rot silently. Core rules only — no plugin, no new dependency.
//
// ESLint merges `overrides` by REPLACING a rule's config with the last matching
// block, it does not concatenate. So the blocks below go from general to
// specific, and every specific block repeats the groups it must keep — a
// domain file matches three of them, and only the last one would survive.

/** From outside a module, nothing reaches past its index.ts (rule 7). */
const BARRERA_MODULOS = {
  group: ['**/modules/*/*', '**/modules/*/*/**'],
  message: 'Import the module barrel (modules/<name>), not its internals.',
};

/** Same rule between siblings: '../favorites', never '../favorites/ui/x'. */
const BARRERA_ENTRE_MODULOS = {
  group: [
    '../../*/domain/**',
    '../../*/application/**',
    '../../*/infrastructure/**',
    '../../*/ui/**',
  ],
  message: 'Another module is reached through its index.ts, not through its layers.',
};

module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  plugins: [
    'react',
    '@typescript-eslint'
  ],
  settings: {
    react: {
      version: 'detect'
    }
  },
  rules: {
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    "react/react-in-jsx-scope": "off"
  },
  overrides: [
    {
      // Everything outside the modules: pages, app, tests and the legacy
      // folders. They consume modules only through the barrel.
      files: ['src/**/*.ts', 'src/**/*.tsx'],
      excludedFiles: ['src/modules/**'],
      rules: {
        'no-restricted-imports': ['error', { patterns: [BARRERA_MODULOS] }],
      },
    },
    {
      // Inside a module: its own internals are free, its siblings are not.
      files: ['src/modules/**/*.ts', 'src/modules/**/*.tsx'],
      rules: {
        'no-restricted-imports': ['error', { patterns: [BARRERA_ENTRE_MODULOS] }],
      },
    },
    {
      // Infrastructure is the outward edge: it maps DTOs and talks to the
      // network or to storage. Nothing it does needs a component or a hook.
      files: ['src/modules/*/infrastructure/**/*.ts', 'src/modules/*/infrastructure/**/*.tsx'],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: [
            BARRERA_ENTRE_MODULOS,
            {
              group: ['react', 'react-dom', '@ionic/*', 'ionicons*', '**/ui/**', '**/application/**'],
              message: 'Infrastructure must not depend on UI or application wiring.',
            },
          ],
        }],
      },
    },
    {
      // A domain layer is pure TypeScript: it takes data and returns data. No
      // UI framework, no browser API, no configuration, no I/O.
      files: ['src/modules/*/domain/**/*.ts'],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: [
            BARRERA_ENTRE_MODULOS,
            {
              group: ['react', 'react-dom', 'react-router*', '@ionic/*', 'ionicons*', 'leaflet*', 'react-leaflet*'],
              message: 'Domain code is pure TypeScript: no UI framework here.',
            },
            {
              group: ['**/shared/config/*', '**/infrastructure/**', '**/ui/**', '**/application/**'],
              message: 'Domain code must not depend on configuration, I/O, UI or application wiring.',
            },
          ],
        }],
        'no-restricted-globals': ['error',
          { name: 'fetch', message: 'Domain code does not do I/O — the request belongs in infrastructure/.' },
          { name: 'localStorage', message: 'Domain code does not persist — storage belongs in infrastructure/.' },
          { name: 'sessionStorage', message: 'Domain code does not persist — storage belongs in infrastructure/.' },
          { name: 'document', message: 'Domain code does not touch the DOM.' },
          { name: 'window', message: 'Domain code does not touch the browser.' },
        ],
      },
    },
    {
      // shared/ sits upstream of every module: it may never import one. The
      // legacy folders are listed too because they are the modules-to-be.
      files: ['src/shared/**/*.ts', 'src/shared/**/*.tsx', 'src/shared/**/*.js'],
      // Tests are consumers, not production dependencies: a test that renders a
      // page to check its canonical URL creates no coupling in the bundle.
      excludedFiles: ['**/*.test.ts', '**/*.test.tsx'],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: [
            {
              group: ['**/modules/**', '**/pages/**', '**/app/**'],
              message: 'shared/ must not depend on modules, pages or app.',
            },
            {
              group: ['**/services/**', '**/features/**', '**/hooks/**', '**/utils/**', '**/components/**'],
              message: 'shared/ must not depend on module code (these folders are becoming modules).',
            },
          ],
        }],
      },
    },
  ],
}
