import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getSteeringWords } from '../test-utils/get-steering-words.ts';
import { gateTexts } from './gate-texts.ts';

function setupTest() {
  const doc = readFileSync(
    join(import.meta.dir, '../../../../docs/design/wherewerewe/sessions-and-hooks.md'),
    'utf8',
  );

  return {
    doc,
    texts: {
      standard: gateTexts.standardReason('tide-alerts', 'claude'),
      standardCodex: gateTexts.standardReason('tide-alerts', 'codex'),
      cut: gateTexts.cutReason('tide-alerts'),
      failOpen: gateTexts.failOpenLine('tide-alerts'),
      subagent: gateTexts.subagentLine('<name>'),
      nudge: gateTexts.nudge('tide-alerts', '47m'),
    },
  };
}

test.each(['standard', 'standardCodex', 'cut', 'failOpen', 'subagent', 'nudge'] as const)(
  'it holds the design text of the %s text, line by line',
  (key) => {
    const ctx = setupTest();
    const lines = ctx.texts[key].split('\n');

    expect(lines.filter((line) => !ctx.doc.includes(line))).toStrictEqual([]);
  },
);

test('it holds no word that tells the agent to hold back, to ask or to act inside a limit', () => {
  const ctx = setupTest();

  expect(Object.values(ctx.texts).flatMap((text) => getSteeringWords(text))).toStrictEqual([]);
});
