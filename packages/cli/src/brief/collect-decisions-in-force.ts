import type { JournalRow } from '../types.ts';
import { collectDecisionRowsInForce } from './collect-decision-rows-in-force.ts';

export interface DecisionInForce {
  readonly id: string;
  readonly choice: string;
}

// The decisions in force, each as the brief prints it, in the order of their rows.
export function collectDecisionsInForce(rows: readonly JournalRow[]): DecisionInForce[] {
  return collectDecisionRowsInForce(rows).map((row) => ({ id: row.id, choice: row.text ?? '' }));
}
