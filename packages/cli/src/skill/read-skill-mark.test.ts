import { expect, test } from 'bun:test';
import { readSkillMark } from './read-skill-mark.ts';
import { renderSkill } from './render-skill.ts';

function setupTest() {
  return { rendered: renderSkill('1.4.0'), read: readSkillMark };
}

test('it reads back the version and a matching body of a file it rendered', () => {
  const ctx = setupTest();

  expect(readSkillMark(ctx.rendered)).toMatchObject({ version: '1.4.0', bodyMatches: true });
});

test('it reads the mark of an older version whose body nobody edited', () => {
  const ctx = setupTest();

  expect(
    readSkillMark(ctx.rendered.replace('wherewerewe 1.4.0', 'wherewerewe 0.9.2')),
  ).toMatchObject({
    version: '0.9.2',
    bodyMatches: true,
  });
});

test('it reads bodyMatches false for an edited body', () => {
  const ctx = setupTest();

  expect(readSkillMark(`${ctx.rendered}\nAlso do this.\n`)).toMatchObject({ bodyMatches: false });
});

test.each([
  {
    title: 'a hand-written skill',
    text: '---\nname: www\ndescription: "Keeps what is true."\n---\n\n# www\n\nRun `www`.\n',
  },
  { title: 'a file with no frontmatter', text: '# www\n\nRun `www`.\n' },
  { title: 'an empty file', text: '' },
])('it reads null for $title', (row) => {
  const ctx = setupTest();

  expect(ctx.read(row.text)).toBeNull();
});
