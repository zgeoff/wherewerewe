import config from '@zgeoff/oxfmt-config';
import { defineConfig } from 'oxfmt';

export default defineConfig({
  ...config,
  ignorePatterns: [
    ...config.ignorePatterns,

    // the design docs and decision records keep the wrapping and tables their authors gave them
    'docs/decisions/**',
    'docs/design/**',
  ],
});
