import { match } from 'ts-pattern';
import { faultCredential } from './build-grant-fault-cases.ts';

export interface WriteFaultCase {
  // the command, the slot and the fault, such as `task claim: a credential`
  readonly title: string;

  // the writes that make the store the command needs
  readonly setup: readonly (readonly string[])[];
  readonly argv: readonly string[];
}

// A write with a sound value in each slot. `{name}` marks a slot that a fault replaces.
interface WriteTemplate {
  readonly command: string;
  readonly words: readonly string[];
}

const templates: readonly WriteTemplate[] = [
  { command: 'task', words: ['task', '{id}', '{claim}', '--note', '{note}'] },
  { command: 'wait', words: ['wait', '{id}', '{claim}', '--who', '{who}'] },
  { command: 'rule', words: ['rule', '{id}', '{claim}'] },
  { command: 'where', words: ['where', '{id}', '{claim}'] },
  {
    command: 'ok',
    words: [
      'ok',
      '{id}',
      '--quote',
      '{quote}',
      '--who',
      '{who}',
      '--where',
      '{where}',
      '--scope',
      'the pump',
    ],
  },
  { command: 'set', words: ['set', 't-a', '{claim}', '--note', '{note}'] },
  { command: 'now', words: ['now', 't-a', '{next}'] },
  { command: 'goal', words: ['goal', '{goal}'] },
  { command: 'done', words: ['done', 't-a', '--evidence', '{evidence}'] },
  { command: 'drop', words: ['drop', 't-a', '--why', '{why}'] },
  { command: 'use', words: ['use', 'o-a', '--for', '{for}'] },
  { command: 'decide', words: ['decide', '{choice}', '--why', '{why}'] },
  { command: 'init', words: ['init', '{name}', '--goal', '{goal}'] },
];

// Each write command with each text fault in each of its text slots, each id fault in its id
// slot, and every slot of the command faulted at once.
export function buildWriteFaultCases(): WriteFaultCase[] {
  return [
    ...templates.flatMap((template) => buildSlotCases(template)),
    ...templates.flatMap((template) => buildEverySlotCases(template)),
  ];
}

function buildSlotCases(template: WriteTemplate): WriteFaultCase[] {
  return getSlots(template).flatMap((slot) =>
    pickFaults(slot).map(([fault, value]) => ({
      title: `${template.command} ${slot}: ${fault}`,
      setup: pickSetup(template),
      argv: fillSlots(template, new Map([[slot, value]])),
    })),
  );
}

function getSlots(template: WriteTemplate): string[] {
  return template.words.flatMap((word) => (/^\{\w+\}$/u.test(word) ? [word.slice(1, -1)] : []));
}

type Fault = readonly [string, string];

const idFaults: readonly Fault[] = [
  ['an upper-case id', 'T-B'],
  ['a reserved id', 'grant'],
  ['a one-letter id', 'x'],
];

const idSlots: ReadonlySet<string> = new Set(['id', 'name']);

const textFaults: readonly Fault[] = [
  ['an empty text', ''],
  ['a dash', '-'],
  ['over 400 characters', 'long '.repeat(90)],
  ['a line break', 'two\nlines'],
  ['a credential', `token ${faultCredential}`],
];

// A session name may be grant, which only an item id keeps back.
function pickFaults(slot: string): readonly Fault[] {
  const ids = slot === 'name' ? idFaults.filter(([, value]) => value !== 'grant') : idFaults;

  return idSlots.has(slot) ? [...ids, ...textFaults] : textFaults;
}

// Every case but init writes against a task t-a, and init starts with no store. use spends an
// approval o-a, which only its cases open, because the brief holds one approval at a time.
const baseSetup: readonly (readonly string[])[] = [
  ['init', 'tide-alerts', '--goal', 'Ship it'],
  ['task', 't-a', 'Water the beds'],
];

const approvalSetup: readonly string[] = [
  'ok',
  'o-a',
  '--quote',
  'go ahead',
  '--who',
  'sam',
  '--where',
  'chat',
  '--scope',
  'the pump',
];

function pickSetup(template: WriteTemplate): readonly (readonly string[])[] {
  return match(template.command)
    .with('init', () => [])
    .with('use', () => [...baseSetup, approvalSetup])
    .otherwise(() => baseSetup);
}

const soundValues: Readonly<Record<string, string>> = {
  id: 'n-b',
  name: 'n-b',
  claim: 'Feed the fish',
  note: 'Check the filter',
  who: 'sam',
  quote: 'go ahead',
  where: 'chat',
  next: 'Rinse the tank',
  goal: 'Ship the pump',
  evidence: 'commit 4c1d2e0',
  why: 'The pump is fixed',
  for: 'the pump fix',
  choice: 'Use the small pump',
};

function fillSlots(template: WriteTemplate, faults: ReadonlyMap<string, string>): string[] {
  return template.words.map((word) => {
    const slot = /^\{(?<slot>\w+)\}$/u.exec(word)?.groups?.['slot'];

    return slot === undefined ? word : (faults.get(slot) ?? soundValues[slot] ?? word);
  });
}

function buildEverySlotCases(template: WriteTemplate): WriteFaultCase[] {
  const slots = getSlots(template);

  return textFaults.map(([fault, value]) => ({
    title: `${template.command}, every slot: ${fault}`,
    setup: pickSetup(template),
    argv: fillSlots(template, new Map(slots.map((slot) => [slot, pickSlotValue(slot, value)]))),
  }));
}

// An id or name slot faulted with a text fault takes the upper-case id, so every slot holds a
// fault.
function pickSlotValue(slot: string, value: string): string {
  return idSlots.has(slot) ? 'T-B' : value;
}
