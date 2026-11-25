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
    head: 'release-please--branches--main--components--@wherewerewe/cli',
    user: { type: 'Bot', login: 'zgeoff-release-please[bot]' },
    body: null,
    step: { kind: 'skip', reason: 'a release pull request carries no verify report' },
  },
  {
    title: "a person's branch named like the release branch",
    head: 'release-please--branches--main--components--@wherewerewe/cli',
    user: { type: 'User', login: 'river-otter' },
    body: '',
    step: { kind: 'gate', baseRef: 'main', body: '' },
  },
  {
    title: "another bot's pull request from the release branch",
    head: 'release-please--branches--main--components--@wherewerewe/cli',
    user: { type: 'Bot', login: 'acme-release[bot]' },
    body: '',
    step: { kind: 'gate', baseRef: 'main', body: '' },
  },
  {
    title: "the release bot's pull request from a fork",
    head: 'release-please--branches--main--components--@wherewerewe/cli',
    user: { type: 'Bot', login: 'zgeoff-release-please[bot]' },
    headRepo: { full_name: 'fork-owner/notes' },
    body: '',
    step: { kind: 'gate', baseRef: 'main', body: '' },
  },
  {
    title: "the release bot's pull request from a deleted fork",
    head: 'release-please--branches--main--components--@wherewerewe/cli',
    user: { type: 'Bot', login: 'zgeoff-release-please[bot]' },
    headRepo: null,
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
      base: { ref: 'main', repo: { full_name: 'owner/notes' } },
      head: {
        ref: row.head,
        repo: row.headRepo === undefined ? { full_name: 'owner/notes' } : row.headRepo,
      },
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
