type RunCommand = (argv: readonly string[]) => Promise<number>;

export interface DispatchPublishOptions {
  readonly releaseOutputsText: string;
  readonly repository: string;
  readonly runCommand: RunCommand;
  readonly writeError: (text: string) => void;
}

// npm provenance names the run's own commit as the source, so the publish runs in a second run of
// main.yml, dispatched at the release tag, whose commit is the tagged one.
export function dispatchPublish(options: DispatchPublishOptions): Promise<number> {
  const outputs = readRecord(JSON.parse(options.releaseOutputsText));
  const pathsValue = outputs['paths_released'];
  const paths: unknown = typeof pathsValue === 'string' ? JSON.parse(pathsValue) : pathsValue;

  if (!Array.isArray(paths) || paths.length !== 1 || typeof paths[0] !== 'string') {
    options.writeError(`::error::expected one released package, got: ${JSON.stringify(paths)}\n`);

    return Promise.resolve(1);
  }

  const tag = outputs[`${paths[0]}--tag_name`];

  if (typeof tag !== 'string' || tag === '') {
    options.writeError(`::error::no tag for the released package ${paths[0]}\n`);

    return Promise.resolve(1);
  }

  return options.runCommand([
    'gh',
    'workflow',
    'run',
    'main.yml',
    '--repo',
    options.repository,
    '--ref',
    tag,
    '-f',
    `republish_paths=${JSON.stringify(paths)}`,
  ]);
}

function readRecord(value: unknown): Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null ? { ...value } : {};
}

if (import.meta.main) {
  process.exitCode = await dispatchPublish({
    releaseOutputsText: process.env['RELEASE_OUTPUTS'] ?? '{}',
    repository: process.env['GITHUB_REPOSITORY'] ?? '',
    runCommand: (argv) => Bun.spawn([...argv], { stdio: ['ignore', 'inherit', 'inherit'] }).exited,
    writeError: (text) => {
      process.stderr.write(text);
    },
  });
}
