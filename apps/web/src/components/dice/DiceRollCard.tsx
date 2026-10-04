import type { DiceRoll, DiceRollGroup } from "@questdreamer/types";
import { DieIcon } from "./DieIcon";
import { getRollOutcome, type RollOutcome } from "@/lib/dice";

const OUTCOME_STYLES: Record<RollOutcome, { total: string; card: string; badge?: string; label?: string }> = {
  max: {
    total: "text-secondary text-glow-secondary",
    card: "border-secondary/50 glow-secondary",
    badge: "bg-secondary/15 text-secondary border-secondary/40",
    label: "MAX",
  },
  min: {
    total: "text-danger text-glow-danger",
    card: "border-danger/50 glow-danger",
    badge: "bg-danger/15 text-danger border-danger/40",
    label: "MIN",
  },
  normal: {
    total: "text-primary text-glow-primary",
    card: "border-border-subtle",
  },
};

function dieResultClass(value: number, sides: number) {
  if (value === sides) return "text-secondary border-secondary/40 bg-secondary/10";
  if (value === 1) return "text-danger border-danger/40 bg-danger/10";
  return "text-text-base border-border-subtle bg-surface-container";
}

/** Fallback for rolls without structured groups (older payloads) */
function legacyGroups(roll: DiceRoll): DiceRollGroup[] {
  return [{ count: roll.results.length, sides: 0, sign: 1, results: roll.results }];
}

export function DiceRollCard({ roll }: { roll: DiceRoll }) {
  const groups = roll.groups?.length ? roll.groups : legacyGroups(roll);
  const modifier = roll.modifier ?? 0;
  const outcome = roll.groups?.length ? getRollOutcome(roll.total, groups, modifier) : "normal";
  const style = OUTCOME_STYLES[outcome];
  const mainDie = groups[0]?.sides || 20;

  return (
    <div className={`relative bg-surface-base border rounded p-3 animate-roll-in overflow-hidden ${style.card}`}>
      {/* Formula */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <DieIcon sides={mainDie} className="w-3.5 h-3.5 text-text-muted shrink-0" />
          <span className="font-telemetry text-[11px] text-text-muted truncate">{roll.formula}</span>
        </div>
        {style.label && (
          <span className={`label-caps px-1.5 py-0.5 rounded border ${style.badge}`}>{style.label}</span>
        )}
      </div>

      <div className="flex items-end justify-between gap-3">
        {/* Breakdown */}
        <div className="flex flex-wrap items-center gap-1 font-telemetry text-[11px] min-w-0">
          {groups.map((g, gi) => (
            <span key={gi} className="flex flex-wrap items-center gap-1">
              {(gi > 0 || g.sign === -1) && (
                <span className="text-text-muted/60 px-0.5">{g.sign === -1 ? "−" : "+"}</span>
              )}
              {g.results.map((r, ri) => (
                <span
                  key={ri}
                  title={g.sides ? `d${g.sides}` : undefined}
                  className={`min-w-[22px] h-[22px] px-1 rounded border flex items-center justify-center ${
                    g.sides ? dieResultClass(r, g.sides) : "text-text-base border-border-subtle bg-surface-container"
                  }`}
                >
                  {r}
                </span>
              ))}
            </span>
          ))}
          {modifier !== 0 && (
            <span className="text-text-muted px-0.5">
              {modifier > 0 ? "+" : "−"} {Math.abs(modifier)}
            </span>
          )}
        </div>

        {/* Total */}
        <div
          className={`font-telemetry text-[28px] leading-none font-bold shrink-0 animate-total-pop ${style.total}`}
          aria-label={`Total ${roll.total}`}
        >
          {roll.total}
        </div>
      </div>
    </div>
  );
}
