import js from '@eslint/js';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        React: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      // D-22: Forbid hardcoded hex color literals in JSX/TSX files
      // Use Tailwind classes (bg-brand-primary) or CSS vars (var(--brand-primary)) instead
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[value.type='Literal'][value.value=/^#[0-9a-fA-F]{3,8}$/]",
          message:
            'D-22: Hardcoded hex colors are forbidden in JSX attributes. Use Tailwind classes (bg-brand-primary) or CSS variables (var(--brand-primary)) instead.',
        },
        {
          selector:
            "Property[key.name='className'][value.type='Literal'][value.value=/#[0-9a-fA-F]{3,8}/]",
          message:
            'D-22: Hardcoded hex colors are forbidden in className strings. Use Tailwind classes instead.',
        },
      ],
      'react/react-in-jsx-scope': 'off', // Not needed with React 18 JSX transform
    },
  },
];
