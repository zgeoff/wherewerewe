import fc from 'fast-check';

// One step of a close model run: a write of the kind's row, or a close of it that may stop after
// its journal row. `tick` moves the clock before the step, so 0 keeps it in the second before.
export type CloseModelStep =
  | { readonly op: 'write'; readonly id: string; readonly text: string; readonly tick: 0 | 1 }
  | {
      readonly op: 'close';
      readonly id: string;
      readonly command: 'done' | 'drop';
      readonly isInterrupted: boolean;
      readonly tick: 0 | 1;
    };

// Up to 12 steps over the given ids and two texts, so a replacement of the same text in the same
// second as an interrupted close comes up often.
export function buildCloseModelSteps(ids: readonly string[]): fc.Arbitrary<CloseModelStep[]> {
  const id = fc.constantFrom(...ids);
  const tick = fc.constantFrom<0 | 1>(0, 1);
  const text = fc.constantFrom('Pin the clock', 'Seed the table');
  const write = fc.record({ op: fc.constant('write' as const), id, text, tick });

  const close = fc.record({
    op: fc.constant('close' as const),
    id,
    command: fc.constantFrom<'done' | 'drop'>('done', 'drop'),
    isInterrupted: fc.boolean(),
    tick,
  });

  return fc.array(fc.oneof(write, close), { maxLength: 12 });
}
