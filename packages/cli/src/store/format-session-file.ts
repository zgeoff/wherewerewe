import type { SessionFile } from '../types.ts';

export function formatSessionFile(session: SessionFile): string {
  const lines = [
    `format=${session.format}`,
    `name=${session.name}`,
    `goal=${session.goal}`,
    `grant=${session.grant?.words ?? ''}`,
    `grant_reading=${session.grant?.reading ?? ''}`,
    `grant_where=${session.grant?.where ?? ''}`,
    `grant_set=${session.grant?.set ?? ''}`,
    `started=${session.started}`,
    `now=${session.now ?? ''}`,
    `now_next=${session.nowNext ?? ''}`,
    `now_set=${session.nowSet ?? ''}`,
    `last_write=${session.lastWrite ?? ''}`,
    `last_nudge=${session.lastNudge ?? ''}`,
    ...(session.importedFrom === null ? [] : [`imported_from=${session.importedFrom}`]),
  ];

  return `${lines.join('\n')}\n`;
}
