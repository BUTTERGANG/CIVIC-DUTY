import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Flags any synchronous setState inside an effect as a cascading-render
      // risk. Every occurrence here is a deliberate state reset on a dependency
      // change — raising a loading flag before a refetch, clearing alerts on
      // sign-out, closing the mobile nav on navigation. Those are correct as
      // written, and the extra render is the intended one. Kept as a warning so
      // genuinely accidental cases still surface in review.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    // Context modules deliberately export a Provider component alongside its
    // useX hook — the standard React context shape. The rule is about Fast
    // Refresh granularity in dev, not correctness, and splitting each context
    // into two files to satisfy it would be churn for no runtime benefit.
    files: ['src/context/**/*.tsx', 'src/components/Shared.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
