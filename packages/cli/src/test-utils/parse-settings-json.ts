interface SettingsHandler {
  type: string;
  command: string;
  timeout?: number;
}

interface SettingsGroup {
  matcher?: string;
  hooks: SettingsHandler[];
}

type SettingsEvent =
  | 'SessionStart'
  | 'PreToolUse'
  | 'PostToolUse'
  | 'PostToolUseFailure'
  | 'SubagentStart'
  | 'Stop';

// The parts of a Claude Code settings file that the install and doctor tests read and edit.
export interface SettingsJson {
  hooks: Partial<Record<SettingsEvent, SettingsGroup[]>>;
  permissions: { allow?: string[]; deny?: string[]; ask?: string[] };
  env?: Record<string, string>;
  theme?: string;
}

// A settings text that the test wrote or `www install` wrote, as the shape those tests use.
export function parseSettingsJson(text: string): SettingsJson {
  const value: unknown = JSON.parse(text);

  if (!isSettingsJson(value)) {
    throw new Error('the settings text is not a JSON object');
  }

  return value;
}

function isSettingsJson(value: unknown): value is SettingsJson {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
