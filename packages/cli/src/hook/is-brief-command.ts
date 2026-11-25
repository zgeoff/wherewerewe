// True for the one command that reads the brief: bare www, alone, with at most --session.
export function isBriefCommand(command: string): boolean {
  const inner =
    /^\s*(?:\S*\/)?(?:ba|z)?sh\s+-l?c\s+(?<quoted>.+)$/su.exec(command)?.groups?.['quoted'] ??
    command;

  const plain = inner.trim().replace(/^(?<quote>['"])(?<body>.*)\k<quote>$/su, '$<body>');

  return /^(?:\S*\/)?(?:www|wherewerewe)(?:\s+--session\s+[a-z0-9-]+)?\s*$/u.test(plain.trim());
}
