import { expect, test } from 'bun:test';
import { pickGateStep } from './pick-gate-step.ts';

test.each([
  {
    title: 'a person, with the body',
    head: 'add-notes',
    user: { type: 'User', login: 'river-otter' },
    body: 'report',
    step: { kind: 'gate', baseRef: 'main', body: 'report' },
  },
  {
    title: 'an empty body, as empty text',
    head: 'add-notes',
    user: { type: 'User', login: 'river-otter' },
    body: null,
    step: { kind: 'gate', baseRef: 'main', body: '' },
  },
  {
    title: "a bot's release pull request",
    head: 'release-please--branches--main',
    user: { type: 'Bot', login: 'acme-release[bot]' },
    body: null,
    step: { kind: 'skip', reason: 'a release pull request carries no verify report' },
  },
  {
    title: "a person's branch named like the release branch",
    head: 'release-please--branches--main',
    user: { type: 'User', login: 'river-otter' },
    body: '',
    step: { kind: 'gate', baseRef: 'main', body: '' },
  },
  {
    title: 'a Renovate pull request',
    head: 'renovate/zod-4.x',
    user: { type: 'Bot', login: 'zgeoff-renovate[bot]' },
    body: null,
    step: { kind: 'skip', reason: 'a Renovate pull request carries no verify report' },
  },
  {
    title: "another bot's renovate/ branch",
    head: 'renovate/zod-4.x',
    user: { type: 'Bot', login: 'other[bot]' },
    body: '',
    step: { kind: 'gate', baseRef: 'main', body: '' },
  },
])('it picks the step for $title', (row) => {
  const event = {
    pull_request: {
      body: row.body,
      base: { ref: 'main' },
      head: { ref: row.head },
      user: row.user,
    },
  };

  expect(pickGateStep(event)).toStrictEqual(row.step);
});

test('it refuses an event with no pull request', () => {
  expect(pickGateStep({ ref: 'refs/heads/main' })).toStrictEqual({
    kind: 'refused',
    message: 'the event holds no pull request; run this on pull_request',
  });
});
