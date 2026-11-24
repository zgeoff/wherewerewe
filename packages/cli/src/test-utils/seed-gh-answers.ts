import { seedStubCommand } from './seed-stub-command.ts';

const views: Readonly<Record<string, string>> = {
  'OPEN passing':
    '{"state":"OPEN","statusCheckRollup":[{"name":"unit","status":"COMPLETED","conclusion":"SUCCESS"}]}',
  'OPEN pending':
    '{"state":"OPEN","statusCheckRollup":[{"name":"unit","status":"IN_PROGRESS","conclusion":""}]}',
  'OPEN failing':
    '{"state":"OPEN","statusCheckRollup":[{"name":"oxlint","status":"COMPLETED","conclusion":"FAILURE"}]}',
  'OPEN no checks': '{"state":"OPEN","statusCheckRollup":[]}',
  MERGED: '{"state":"MERGED","statusCheckRollup":[]}',
  CLOSED: '{"state":"CLOSED","statusCheckRollup":[]}',
};

// Puts a stub gh in the folder that answers `gh pr view` for each `<owner>/<repo>#<n>` with the
// view of one result, such as `OPEN failing`, and fails for any other pull request as the real gh
// does for one it cannot find.
export function seedGhAnswers(folder: string, answers: Readonly<Record<string, string>>): string {
  const cases = Object.entries(answers).map(([ref, result]) => {
    const view = views[result];

    if (view === undefined) {
      throw new Error(`no gh view for the result ${result}`);
    }

    return `  '${ref}') printf '%s' '${view}' ;;`;
  });

  return seedStubCommand(
    folder,
    'gh',
    `case "$5#$3" in\n${cases.join('\n')}\n  *) echo 'Could not resolve to a PullRequest' >&2; exit 1 ;;\nesac`,
  );
}
