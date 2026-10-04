import type { DiceRollGroup } from "@questdreamer/types";

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

export const STANDARD_DICE = [4, 6, 8, 10, 12, 20, 100] as const;
export type StandardDie = (typeof STANDARD_DICE)[number];

/** Safety limits so nobody freezes the table with "99999d99999" */
export const MAX_DICE_PER_GROUP = 100;
export const MAX_TOTAL_DICE = 200;
export const MAX_SIDES = 1000;
export const MAX_MODIFIER = 9999;

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

/** A parsed (not yet rolled) dice term, e.g. "-2d8" */
export interface DiceTerm {
  count: number;
  sides: number;
  sign: 1 | -1;
}

export interface ParsedDiceExpression {
  terms: DiceTerm[];
  modifier: number;
}

export interface RolledExpression {
  formula: string;
  groups: DiceRollGroup[];
  modifier: number;
  total: number;
  results: number[];
}

export type RollOutcome = "max" | "min" | "normal";

// ──────────────────────────────────────────────
// Parsing
// ──────────────────────────────────────────────

/** Optional chat command prefix: "/roll 1d20" or "/r 1d20" */
const COMMAND_PREFIX = /^\/(?:roll|r)\s+/i;
/** A single signed term: "+ 2d8", "- 3", "d20" */
const TERM = /([+-])?\s*(?:(\d*)\s*[dD]\s*(\d+)|(\d+))/y;

/**
 * Parses a full dice expression like "1d4 + 2d8 - 1".
 * Returns null if the text is not *only* a dice expression
 * (e.g. "1d20 to hit" is treated as a normal chat message).
 */
export function parseDiceExpression(input: string): ParsedDiceExpression | null {
  const text = input.trim().replace(COMMAND_PREFIX, "");
  if (!text) return null;

  const terms: DiceTerm[] = [];
  let modifier = 0;
  let totalDice = 0;
  let pos = 0;
  let first = true;

  while (pos < text.length) {
    // Skip whitespace between terms
    while (text[pos] === " " || text[pos] === "\t") pos++;
    if (pos >= text.length) break;

    TERM.lastIndex = pos;
    const m = TERM.exec(text);
    if (!m) return null;

    const [, signStr, countStr, sidesStr, flatStr] = m;
    // Every term after the first must have an explicit +/- operator
    if (!first && !signStr) return null;
    const sign: 1 | -1 = signStr === "-" ? -1 : 1;

    if (sidesStr !== undefined) {
      const count = countStr ? parseInt(countStr, 10) : 1;
      const sides = parseInt(sidesStr, 10);
      if (count < 1 || count > MAX_DICE_PER_GROUP) return null;
      if (sides < 2 || sides > MAX_SIDES) return null;
      totalDice += count;
      if (totalDice > MAX_TOTAL_DICE) return null;
      terms.push({ count, sides, sign });
    } else {
      const value = parseInt(flatStr, 10);
      if (value > MAX_MODIFIER) return null;
      modifier += sign * value;
    }

    pos = TERM.lastIndex;
    first = false;
  }

  // Must contain at least one die, otherwise "5 + 3" would be a roll
  if (terms.length === 0) return null;
  return { terms, modifier };
}

// ──────────────────────────────────────────────
// Rolling
// ──────────────────────────────────────────────

/** Unbiased random integer in [1, sides] using the Web Crypto API */
function rollDie(sides: number): number {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / sides) * sides; // rejection sampling
  let x: number;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return (x % sides) + 1;
}

export function formatFormula(terms: DiceTerm[], modifier: number): string {
  const parts: string[] = [];
  terms.forEach((t, i) => {
    const body = `${t.count}d${t.sides}`;
    if (i === 0) parts.push(t.sign === -1 ? `-${body}` : body);
    else parts.push(`${t.sign === -1 ? "-" : "+"} ${body}`);
  });
  if (modifier !== 0) {
    const abs = Math.abs(modifier);
    parts.push(parts.length === 0 ? `${modifier}` : `${modifier < 0 ? "-" : "+"} ${abs}`);
  }
  return parts.join(" ");
}

export function rollExpression(expr: ParsedDiceExpression): RolledExpression {
  const groups: DiceRollGroup[] = expr.terms.map((t) => ({
    count: t.count,
    sides: t.sides,
    sign: t.sign,
    results: Array.from({ length: t.count }, () => rollDie(t.sides)),
  }));

  const diceSum = groups.reduce(
    (acc, g) => acc + g.sign * g.results.reduce((a, b) => a + b, 0),
    0,
  );

  return {
    formula: formatFormula(expr.terms, expr.modifier),
    groups,
    modifier: expr.modifier,
    total: diceSum + expr.modifier,
    results: groups.flatMap((g) => g.results),
  };
}

// ──────────────────────────────────────────────
// Outcome helpers
// ──────────────────────────────────────────────

/** Lowest and highest totals the expression can produce */
export function getRollBounds(groups: DiceRollGroup[], modifier: number) {
  let min = modifier;
  let max = modifier;
  for (const g of groups) {
    if (g.sign === 1) {
      min += g.count;
      max += g.count * g.sides;
    } else {
      min -= g.count * g.sides;
      max -= g.count;
    }
  }
  return { min, max };
}

export function getRollOutcome(total: number, groups: DiceRollGroup[], modifier: number): RollOutcome {
  const { min, max } = getRollBounds(groups, modifier);
  if (min === max) return "normal";
  if (total === max) return "max";
  if (total === min) return "min";
  return "normal";
}
