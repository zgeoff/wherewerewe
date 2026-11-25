import { createHash } from 'node:crypto';

export interface SkillMark {
  readonly version: string;
  readonly bodySHA256: string;

  // whether the body is the one that the mark's hash was taken of
  readonly bodyMatches: boolean;
}

// The mark of a skill file that `renderSkill` wrote, or `null` for a file with none, such as a
// skill written by hand. A file with a mark whose body was edited since reads `bodyMatches: false`.
export function readSkillMark(text: string): SkillMark | null {
  const parts = /^---\n(?<front>[\s\S]*?)\n---\n\n(?<body>[\s\S]*)$/u.exec(text);
  const front = parts?.groups?.['front'] ?? '';
  const body = parts?.groups?.['body'];

  const version = /^ {2}written-by: wherewerewe (?<version>\S+)$/mu.exec(front)?.groups?.[
    'version'
  ];

  const hash = /^ {2}body-sha256: (?<hash>[0-9a-f]{64})$/mu.exec(front)?.groups?.['hash'];

  if (body === undefined || version === undefined || hash === undefined) {
    return null;
  }

  return {
    version,
    bodySHA256: hash,
    bodyMatches: createHash('sha256').update(body).digest('hex') === hash,
  };
}
