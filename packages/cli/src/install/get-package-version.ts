import packageJSON from '../../package.json' with { type: 'json' };

// The version of this package, which the skill's mark names.
export function getPackageVersion(): string {
  return packageJSON.version;
}
