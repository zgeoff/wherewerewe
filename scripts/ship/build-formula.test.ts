import { expect, test } from 'bun:test';
import { buildFormula } from './build-formula.ts';

function setupTest() {
  const hashes = {
    'darwin-arm64': 'a'.repeat(64),
    'darwin-x64': 'b'.repeat(64),
    'linux-arm64': 'c'.repeat(64),
    'linux-x64': 'd'.repeat(64),
  };

  return {
    hashes,
    checksums: Object.entries(hashes)
      .map(([target, hash]) => `${hash}  wherewerewe-${target}\n`)
      .join(''),
    buildFormula,
  };
}

test('it writes the formula of a release, with a url and a checksum for each platform', () => {
  const ctx = setupTest();

  const formula = ctx.buildFormula({
    version: '0.2.0',
    tag: '@wherewerewe/cli@0.2.0',
    checksums: ctx.checksums,
  });

  expect(formula).toBe(`class Wherewerewe < Formula
  desc "Notes for one long agent session, read back as one brief"
  homepage "https://github.com/zgeoff/wherewerewe"
  version "0.2.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/zgeoff/wherewerewe/releases/download/@wherewerewe/cli@0.2.0/wherewerewe-darwin-arm64"
      sha256 "${ctx.hashes['darwin-arm64']}"
    end
    on_intel do
      url "https://github.com/zgeoff/wherewerewe/releases/download/@wherewerewe/cli@0.2.0/wherewerewe-darwin-x64"
      sha256 "${ctx.hashes['darwin-x64']}"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/zgeoff/wherewerewe/releases/download/@wherewerewe/cli@0.2.0/wherewerewe-linux-arm64"
      sha256 "${ctx.hashes['linux-arm64']}"
    end
    on_intel do
      url "https://github.com/zgeoff/wherewerewe/releases/download/@wherewerewe/cli@0.2.0/wherewerewe-linux-x64"
      sha256 "${ctx.hashes['linux-x64']}"
    end
  end

  def install
    # a bare download may arrive without +x
    binary = Dir["wherewerewe-*"].first
    chmod 0755, binary
    bin.install binary => "wherewerewe"
    bin.install_symlink "wherewerewe" => "www"
  end

  test do
    assert_equal "wherewerewe #{version}\\n", shell_output("#{bin}/wherewerewe --version")
  end
end
`);
});

test('it refuses to write a formula when a platform has no checksum', () => {
  const ctx = setupTest();

  const withoutLinuxArm = ctx.checksums
    .split('\n')
    .filter((line) => !line.includes('linux-arm64'))
    .join('\n');

  expect(() =>
    ctx.buildFormula({
      version: '0.2.0',
      tag: '@wherewerewe/cli@0.2.0',
      checksums: withoutLinuxArm,
    }),
  ).toThrowWithMessage(Error, 'SHA256SUMS holds no checksum for wherewerewe-linux-arm64');
});

test('it refuses to write a formula when a checksum is not a SHA-256 hash', () => {
  const ctx = setupTest();

  expect(() =>
    ctx.buildFormula({
      version: '0.2.0',
      tag: '@wherewerewe/cli@0.2.0',
      checksums: ctx.checksums.replace('a'.repeat(64), 'zz'),
    }),
  ).toThrowWithMessage(Error, 'SHA256SUMS holds no checksum for wherewerewe-darwin-arm64');
});
