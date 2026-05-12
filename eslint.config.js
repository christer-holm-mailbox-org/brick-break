/**
 * eslint.config.js – ESLint flat config (ESLint v9+)
 * Kör: npx eslint brick-break.js
 */
export default [
  {
    // Regler anpassade för vanilla JS ES-moduler i webbläsare
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Webbläsar-globaler
        document: 'readonly',
        window: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        sessionStorage: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'error',
      'eqeqeq': 'error',
      'no-var': 'error',
      'prefer-const': 'warn',
      'semi': ['error', 'always'],
    },
  },
];
