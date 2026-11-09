import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';

// Módulos del backend (plan.md, "Arquitectura modular").
const MODULES = ['auth', 'projects', 'sprints', 'activity', 'backlog', 'flow', 'agent', 'validation', 'artifacts', 'export'];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/generated/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'specs/**',
      '.specify/**',
      '.claude/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  // Frontend: accesibilidad y hooks (Principio VII)
  {
    files: ['frontend/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'jsx-a11y': jsxA11y, 'react-hooks': reactHooks },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  // Arquitectura modular del backend (plan.md, "Arquitectura modular"):
  // un módulo solo importa la interfaz pública (index) de otro módulo.
  {
    files: ['backend/src/modules/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...MODULES.map((name) => ({
              group: [`../${name}/*`, `!../${name}/index`, `!../${name}/index.js`, `../../${name}/*`, `!../../${name}/index`, `!../../${name}/index.js`],
              message: 'Un módulo solo puede importar la interfaz pública (index.ts) de otro módulo.',
            })),
          ],
        },
      ],
    },
  },
  // El motor de validación es puro: sin Prisma, Fastify ni el módulo agent.
  {
    files: ['backend/src/modules/validation/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'fastify', message: 'validation/ es puro: no importa Fastify.' },
            { name: '@prisma/client', message: 'validation/ es puro: no importa Prisma.' },
          ],
          patterns: [
            { group: ['**/generated/prisma/**', '**/platform/db*'], message: 'validation/ es puro: sin acceso a datos.' },
            { group: ['**/agent', '**/agent/**', '../agent*'], message: 'validation/ no depende del módulo agent.' },
          ],
        },
      ],
    },
  },
);
