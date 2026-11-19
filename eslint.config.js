const js = require('@eslint/js');
const globals = require('globals');
module.exports = [
  js.configs.recommended,
  { files: ['app/main.js', 'app/preload.js', 'build/**/*.js', 'eslint.config.js'], languageOptions: { sourceType: 'commonjs', ecmaVersion: 2023, globals: { ...globals.node } } },
  { files: ['app/app.js'], languageOptions: { sourceType: 'script', ecmaVersion: 2023, globals: { ...globals.browser, documentPictureInPicture: 'readonly' } } },
  { rules: { 'no-unused-vars': ['error', { caughtErrors: 'none' }], eqeqeq: 'error', 'no-eval': 'error', 'no-implied-eval': 'error', 'no-new-func': 'error' } }
];
