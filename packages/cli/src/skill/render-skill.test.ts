import { expect, test } from 'bun:test';
import { listCommandShapes } from '../args/parse-cli-args.ts';
import { renderSkill } from './render-skill.ts';

function setupTest() {
  const rendered = renderSkill('1.4.0');
  const body = rendered.slice(rendered.indexOf('\n---\n\n') + 6);

  return { rendered, body, shapes: listCommandShapes() };
}

test('it keeps the body under 350 words', () => {
  const ctx = setupTest();

  expect(ctx.body.split(/\s+/u).filter((word) => word !== '').length).toBeLessThan(350);
});

test('it names only commands the parser takes, and only flags that command takes', () => {
  const ctx = setupTest();

  const spans = [...ctx.body.matchAll(/`(?<span>[^`]+)`/gu)].map(
    (match) => match.groups?.['span'] ?? '',
  );

  const problems = spans
    .filter((span) => span.startsWith('www '))
    .flatMap((span) => {
      const words = span.split(/\s+/u);
      const command = words[1] ?? '';
      const shape = ctx.shapes.find((found) => found.command === command);
      const flags = words.filter((word) => word.startsWith('--'));

      if (!/^[a-z]+$/u.test(command)) {
        return [];
      }

      return shape === undefined
        ? [`${span}: no command ${command}`]
        : flags
            .filter((flag) => !shape.taken.includes(flag.slice(2)))
            .map((flag) => `${span}: ${flag}`);
    });

  expect(problems).toStrictEqual([]);
});

test('it renders frontmatter with the name, a description and the mark, then the body', () => {
  const ctx = setupTest();
  const front = ctx.rendered.slice(0, ctx.rendered.indexOf('\n---\n\n'));

  expect(
    front.split('\n').map((line) => line.replace(/[0-9a-f]{64}/u, '<hash>').slice(0, 40)),
  ).toStrictEqual([
    '---',
    'name: www',
    'description: "Keeps what is true in a lo',
    'metadata:',
    '  written-by: wherewerewe 1.4.0',
    '  body-sha256: <hash>',
  ]);
});

test('it tells the agent when to load the skill in the description', () => {
  const ctx = setupTest();

  expect(ctx.rendered).toContain(
    'Load it at the start of a long or autonomous session, after a compaction, and before stopping work another session will pick up.',
  );
});

test('it holds no line that tells the agent to hold back, to ask or to act inside a limit', () => {
  const ctx = setupTest();

  expect(ctx.body).not.toMatch(/\b(?:ask first|hold back|only inside|stay within|do not act)\b/iu);
});

test('it says that www holds what is true now, and shows a table in place of a run-on note', () => {
  const ctx = setupTest();
  const lines = ctx.body.split('\n');

  expect({
    stops: ctx.body.includes('`www` holds what is true now and where the rest lives.'),
    table: lines.filter((line) => line.startsWith('|')).length >= 3,
  }).toStrictEqual({ stops: true, table: true });
});
