import { textLimits } from '../rules/text-limits.ts';
import { buildCredentialSamples } from './build-credential-samples.ts';

export interface NamedCredentialCell {
  // a cell of seed-json-cells-store.ts that holds an id, a ref or a session name
  readonly cell: string;

  // a value its parser keeps that holds a credential, and the part no output may hold
  readonly value: string;
  readonly tail: string;
}

// The cells with no space in them, which the free-text generators cannot fill, each with a
// credential its parser still keeps, built at run time so no commit holds one.
export function buildNamedCredentialCells(): NamedCredentialCell[] {
  const ghp = buildCredentialSamples().find((entry) => entry.name === 'ghp') ?? {
    sample: '',
    tail: '',
  };

  // an item id takes only lowercase letters, digits and dashes, and a bare xoxb- prefix matches
  const id = (buildCredentialSamples().find((entry) => entry.name === 'xoxb')?.sample ?? '')
    .toLowerCase()
    .slice(0, textLimits.idMax);

  const idTail = id.slice('xoxb-'.length);
  const sessionTail = 'abcdefghijklmnopqrstu';

  return [
    ...['task id', 'wait id', 'lesson id', 'promise id', 'words id', 'owner note on'].map(
      (cell) => ({ cell, value: id, tail: idTail }),
    ),
    { cell: 'decision id', value: id, tail: idTail },
    { cell: 'close id', value: id, tail: idTail },
    { cell: 'session name', value: ['sk', '-', sessionTail].join(''), tail: sessionTail },
    { cell: 'pr ref', value: `acme/${ghp.sample}#9`, tail: ghp.tail },
  ];
}
