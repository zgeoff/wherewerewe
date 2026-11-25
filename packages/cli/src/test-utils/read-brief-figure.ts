interface BriefFigureRead {
  readonly tokens: number | null;
  readonly limit: number | null;
}

// The `Brief: <t> of <limit> tokens.` figure that ends a write reply, or nulls for a reply without
// one.
export function readBriefFigure(reply: string): BriefFigureRead {
  const groups = /Brief: (?<tokens>\d+) of (?<limit>\d+) tokens\.\n?$/u.exec(reply)?.groups;
  const tokens = groups?.['tokens'];
  const limit = groups?.['limit'];

  return {
    tokens: tokens === undefined ? null : Number(tokens),
    limit: limit === undefined ? null : Number(limit),
  };
}
