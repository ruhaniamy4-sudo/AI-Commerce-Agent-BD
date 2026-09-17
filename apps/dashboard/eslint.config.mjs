import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', '.next-dev/**', 'out/**', 'build/**', 'next-env.d.ts']),
  {
    // next.config.js and postcss.config.js are CommonJS by design — Next loads
    // them before any bundler, so an ESM-only rule does not apply to them.
    files: ['*.js', '*.cjs'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    rules: {
      // Arrived with the ESLint 9 / eslint-config-next 16 upgrade and flags 21
      // existing components. Each one is a real refactor of an effect, not a
      // mechanical fix, so they are a visible backlog rather than a blocked
      // build. Drop this override once the effects have been worked through.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
]);
