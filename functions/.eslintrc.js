module.exports = {
  root: true,
  env: { node: true, es2020: true },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    // keep it simple; don't require a tsconfig project for lint
    project: null,
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    // drop "google" so it doesn't force double quotes
    // 'plugin:import/errors', 'plugin:import/warnings', 'plugin:import/typescript' are optional
  ],
  rules: {
    // ✔ allow single quotes (stop "Strings must use doublequote")
    quotes: ['warn', 'single', { avoidEscape: true, allowTemplateLiterals: true }],

    // calm unused vars; allow underscore to ignore
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

    // relax formatting nits
    'no-multiple-empty-lines': ['warn', { max: 2 }],
    'max-len': 'off',
    'require-jsdoc': 'off',

    // import resolver noise off
    'import/no-unresolved': 'off',
  },
  ignorePatterns: [
    'lib/**',          // compiled output
    'generated/**',
    '**/*.js',         // if you only lint TS
  ],
};


