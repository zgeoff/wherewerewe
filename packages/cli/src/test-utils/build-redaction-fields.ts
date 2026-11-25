import { findCredentialMatch } from '../rules/find-credential-match.ts';
import { textLimits } from '../rules/text-limits.ts';
import { buildCredentialSamples } from './build-credential-samples.ts';
import { buildCutPlacement, buildRedactionPlacements } from './build-redaction-placements.ts';

// A stored text of a lesson, a promise, the owner's words or a decision, with the id of the row
// that holds it, the most characters the store reads in it, and whether it refuses ; and =.
export interface RedactionField {
  readonly name: string;
  readonly id: string;
  readonly limit: number;
  readonly isSeparated: boolean;
}

// Each field's value with a credential; as the placeholder alone, as a site that redacts a text
// whole prints it; and with the placeholder where the credential sat, as a site that redacts the
// word prints it. No output may print any of `tails`, the parts after each credential's prefix.
export interface RedactionValues {
  readonly credentials: Readonly<Record<string, string>>;
  readonly placeholders: Readonly<Record<string, string>>;
  readonly placedPlaceholders: Readonly<Record<string, string>>;

  // a plain value of its own for each field, as short as its id, that no other text holds
  readonly markers: Readonly<Record<string, string>>;
  readonly tails: readonly string[];
}

const placeholder = '<where the secret lives>';

const storedFields: readonly RedactionField[] = [
  { name: 'lesson text', id: 'l-1', limit: textLimits.lesson, isSeparated: false },
  { name: 'lesson why', id: 'l-1', limit: textLimits.lessonWhy, isSeparated: false },
  { name: 'promise what', id: 'p-1', limit: textLimits.promise, isSeparated: false },
  { name: 'promise to', id: 'p-1', limit: textLimits.promiseTo, isSeparated: true },
  { name: 'promise by', id: 'p-1', limit: textLimits.promiseBy, isSeparated: true },
  { name: 'second promise what', id: 'p-2', limit: textLimits.promise, isSeparated: false },
  { name: 'words', id: 'w-1', limit: textLimits.words, isSeparated: false },
  { name: 'words where', id: 'w-1', limit: textLimits.wordsWhere, isSeparated: true },
  { name: 'decision choice', id: 'd-1', limit: 300, isSeparated: false },
  { name: 'decision why', id: 'd-1', limit: textLimits.why, isSeparated: false },
];

// Every stored text field of the three kinds and of a decision, with a second promise, whose
// recap line follows the first. A field shorter than the placeholder cannot hold it in a store.
export function buildRedactionFields(): RedactionField[] {
  return [...storedFields];
}

// A distinct credential for each field: field i takes the samples of tail rotation i + 1, the
// pattern `offset + i` on from the first that fits the field, and the placement `offset + i`: at
// the start, across the wrap, at the end, or, where the field takes it, across the 199 cut.
export function buildRedactionValues(
  fields: readonly RedactionField[],
  offset: number,
): RedactionValues {
  const placed = fields.map((field, index) => {
    const samples = buildCredentialSamples(index + 1);

    const builders = [
      ...buildRedactionPlacements().map((placement) => placement.build),
      buildCutPlacement,
    ].filter((build) => build(placeholder).length <= field.limit);

    const build = builders[(offset + index) % builders.length] ?? ((sample: string) => sample);

    // a field shorter than a sample takes its start, which a bare prefix such as ghp_ still matches
    const fitting = samples
      .map((entry) => {
        const sample =
          build(entry.sample).length <= field.limit
            ? entry.sample
            : entry.sample.slice(0, field.limit);

        const prefix = entry.sample.length - entry.tail.length;

        return { sample, tail: sample.slice(prefix) };
      })
      .filter(
        (entry) =>
          build(entry.sample).length <= field.limit &&
          findCredentialMatch(entry.sample) !== null &&
          entry.tail.length >= 4 &&
          !(field.isSeparated && /[;=]/u.test(entry.sample)),
      );

    const credential = fitting[(offset + index) % fitting.length];

    if (credential === undefined) {
      throw new Error(`no credential fits the ${field.name} field`);
    }

    return { field, build, credential };
  });

  return {
    credentials: Object.fromEntries(
      placed.map((entry) => [entry.field.name, entry.build(entry.credential.sample)]),
    ),
    placeholders: Object.fromEntries(placed.map((entry) => [entry.field.name, placeholder])),
    markers: Object.fromEntries(
      placed.map((entry, index) => [entry.field.name, `mark${String(index)}x${entry.field.id}`]),
    ),
    placedPlaceholders: Object.fromEntries(
      placed.map((entry) => [entry.field.name, entry.build(placeholder)]),
    ),
    tails: placed.map((entry) => entry.credential.tail),
  };
}

// True when the field holds the placeholder, so a store can hold it in the field's place.
export function isPlaceholderField(field: RedactionField): boolean {
  return field.limit >= placeholder.length;
}
