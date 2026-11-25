const platforms = [
  { os: 'macos', arch: 'arm', target: 'darwin-arm64' },
  { os: 'macos', arch: 'intel', target: 'darwin-x64' },
  { os: 'linux', arch: 'arm', target: 'linux-arm64' },
  { os: 'linux', arch: 'intel', target: 'linux-x64' },
] as const;

export interface BuildFormulaOptions {
  readonly version: string;
  readonly tag: string;

  // the text of SHA256SUMS, as the binary build wrote it
  readonly checksums: string;
}

// The Homebrew formula for one released version. A platform with no line in the checksums throws:
// a formula without a checksum would install whatever the URL serves.
export function buildFormula(options: BuildFormulaOptions): string {
  const base = `https://github.com/zgeoff/wherewerewe/releases/download/${options.tag}`;

  const blocks = (os: string) =>
    platforms
      .filter((platform) => platform.os === os)
      .map(
        (platform) => `    on_${platform.arch} do
      url "${base}/wherewerewe-${platform.target}"
      sha256 "${getChecksum(options.checksums, `wherewerewe-${platform.target}`)}"
    end`,
      )
      .join('\n');

  return `class Wherewerewe < Formula
  desc "Notes for one long agent session, read back as one brief"
  homepage "https://github.com/zgeoff/wherewerewe"
  version "${options.version}"
  license "MIT"

  on_macos do
${blocks('macos')}
  end

  on_linux do
${blocks('linux')}
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
`;
}

function getChecksum(checksums: string, name: string): string {
  const line = checksums
    .split('\n')
    .map((candidate) => candidate.split(/\s+/u))
    .find((words) => words[1] === name);

  const hash = line?.[0];

  if (hash === undefined || !/^[0-9a-f]{64}$/u.test(hash)) {
    throw new Error(`SHA256SUMS holds no checksum for ${name}`);
  }

  return hash;
}
