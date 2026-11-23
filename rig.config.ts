import { defineRig } from '@zgeoff/rig';

export default defineRig({
  lanes: {},
  programs: {
    www: { package: 'packages/cli', source: 'src/cli.ts', build: 'true', artifact: 'src/cli.ts' },
  },
});
