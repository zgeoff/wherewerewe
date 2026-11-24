import { briefLimits, bytesPerToken } from './brief-limits.ts';

// The brief's limit for the host that reads it, in bytes and in estimated tokens.
export function pickBriefLimit(host: 'claude' | 'codex' | null): {
  readonly bytes: number;
  readonly tokens: number;
} {
  const bytes = host === null ? briefLimits.none : briefLimits[host];

  return { bytes, tokens: bytes / bytesPerToken };
}
