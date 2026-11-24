import { expect, test } from 'bun:test';
import { grantLimits } from '../rules/grant-limits.ts';
import { itemCaps, ownerNoteCap } from '../rules/item-caps.ts';
import { textLimits } from '../rules/text-limits.ts';
import { helpText } from './help-text.ts';

function setupTest() {
  const text = helpText.replaceAll(/\s+/gu, ' ');

  // each figure of each table in the phrase of the help text that holds it
  const textPhrases: Readonly<Record<keyof typeof textLimits, string>> = {
    claim: `a claim is one line of at most ${String(textLimits.claim)} characters`,
    note: `a note ${String(textLimits.note)}`,
    goal: `a goal ${String(textLimits.goal)}`,
    nextStep: `a next step ${String(textLimits.nextStep)}`,
    decision: `a decision ${String(textLimits.decision)} with`,
    why: `with its --why ${String(textLimits.why)}`,
    closeText: `a close --why, --evidence or --for ${String(textLimits.closeText)}`,
    ownerNote: `an owner note ${String(textLimits.ownerNote)}`,
    quote: `--quote ${String(textLimits.quote)}`,
    approvalWho: `--quote ${String(textLimits.quote)}, --who ${String(textLimits.approvalWho)}`,
    approvalWhere: `--who ${String(textLimits.approvalWho)}, --where ${String(textLimits.approvalWhere)}`,
    approvalScope: `--where ${String(textLimits.approvalWhere)} and --scope ${String(textLimits.approvalScope)}`,
    waitWho: `a wait takes --who ${String(textLimits.waitWho)}`,
    idMin: `An id has ${String(textLimits.idMin)} to`,
    idMax: `to ${String(textLimits.idMax)} characters`,
    sessionNameMin: `a session name ${String(textLimits.sessionNameMin)} to`,
    sessionNameMax: `to ${String(textLimits.sessionNameMax)}.`,
  };

  const grantPhrases: Readonly<Record<keyof typeof grantLimits, string>> = {
    words: `words come to ${String(grantLimits.words)}`,
    bullets: `in at most ${String(grantLimits.bullets)} bullets`,
    lines: `on at most ${String(grantLimits.lines)} lines of the brief`,
    scope: `with --scope ${String(grantLimits.scope)}`,
    where: `--where ${String(grantLimits.where)} and`,
    reading: `a reading of ${String(grantLimits.reading)}`,
  };

  const capPhrase = `at most ${String(itemCaps.task)} tasks, ${String(itemCaps.wait)} waits, ${String(itemCaps.ok)} approval, ${String(itemCaps.rule)} rules, ${String(itemCaps.where)} where items and ${String(ownerNoteCap)} owner notes`;

  return { text, textPhrases, grantPhrases, capPhrase };
}

test('it holds each limit of the tables in its own phrase', () => {
  const ctx = setupTest();

  const missing = [
    ...Object.values(ctx.textPhrases),
    ...Object.values(ctx.grantPhrases),
    ctx.capPhrase,
  ].filter((phrase) => !ctx.text.includes(phrase));

  expect(missing).toStrictEqual([]);
});

test('it keeps each line of the Limits text within 100 characters', () => {
  const lines = helpText.split('\n');
  const start = lines.findIndex((line) => line.startsWith('Limits:'));
  const end = lines.findIndex((line) => line.startsWith('Exit codes:'));

  expect(
    lines
      .slice(start, end)
      .filter((line) => Array.from(line, (character) => character).length > 100),
  ).toStrictEqual([]);
});
