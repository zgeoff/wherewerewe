import { expect, test } from 'bun:test';
import { buildCredentialSamples } from '../test-utils/build-credential-samples.ts';
import { buildMockBriefInput } from '../test-utils/build-mock-brief-input.ts';
import { buildMockSession } from '../test-utils/build-mock-session.ts';
import { joinBrief } from './join-brief.ts';

function setupTest() {
  return { joinBrief };
}

test('it joins a brief with no credential in the session name', () => {
  const ctx = setupTest();
  const sample = buildCredentialSamples()[0]?.sample ?? '';
  const input = buildMockBriefInput({ session: buildMockSession({ name: sample }) });

  expect(ctx.joinBrief(input, [], [])).not.toInclude(sample);
});
