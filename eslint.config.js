// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // Apostrophes and quotes inside React Native <Text> are fine; this rule is about HTML.
    rules: { 'react/no-unescaped-entities': 'off' },
  },
  {
    ignores: ['dist/*', 'supabase/functions/*', 'web/*'],
  },
]);
