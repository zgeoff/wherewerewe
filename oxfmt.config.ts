import config from '@zgeoff/oxfmt-config';
import { defineConfig } from 'oxfmt';

export default defineConfig({
  ...config,
  ignorePatterns: [
    ...config.ignorePatterns,

    // verbatim copies that repo-sync delivers from zgeoff/tools; edit them there
    '.agents/skills/ci-design/**',
    '.agents/skills/code-style/**',
    '.agents/skills/docs-writing/**',
    '.agents/skills/testing/**',
    '.claude/hooks/**',

    // the design docs and decision records keep the wrapping and tables their authors gave them
    'docs/decisions/**',
    'docs/design/**',
  ],
});
