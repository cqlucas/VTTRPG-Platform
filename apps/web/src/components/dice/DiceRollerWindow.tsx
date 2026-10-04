"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Dices, GripHorizontal, Minus, Plus, RotateCcw, X } from "lucide-react";
import { DieIcon } from "./DieIcon";
import {
  STANDARD_DICE,
  MAX_DICE_PER_GROUP,
  MAX_MODIFIER,
  formatFormula,
  type DiceTerm,
  type ParsedDiceExpression,
} from "@/lib/dice";

interface DiceRollerWindowProps {
  open: boolean;
  onClose: () => void;
  onRoll: (expr: ParsedDiceExpression) => void;
}

const WINDOW_WIDTH = 320;
const EDGE_MARGIN = 8;

type Counts = Record<number, number>;
const emptyCounts = (): Counts => Object.fromEntries(STANDARD_DICE.map((d) => [d, 0]));

export function DiceRollerWindow({ open, onClose, onRoll }: DiceRollerWindowProps) {
  const windowRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef<{ x: number; y: number } | null>(null);

  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [counts, setCounts] = useState<Counts>(emptyCounts);
  const [modifierText, setModifierText] = useState("0");
  const [bumpKey, setBumpKey] = useState<Record<number, number>>({});

  // ── Positioning ────────────────────────────────

  const clamp = useCallback((x: number, y: number) => {
    const el = windowRef.current;
    const w = el?.offsetWidth ?? WINDOW_WIDTH;
    const h = el?.offsetHeight ?? 400;
    return {
      x: Math.min(Math.max(EDGE_MARGIN, x), window.innerWidth - w - EDGE_MARGIN),
      y: Math.min(Math.max(EDGE_MARGIN, y), window.innerHeight - h - EDGE_MARGIN),
    };
  }, []);

  // First open: dock next to the chat panel, near the input
  useLayoutEffect(() => {
    if (!open || position) return;
    const h = windowRef.current?.offsetHeight ?? 400;
    setPosition(clamp(window.innerWidth - 340 - WINDOW_WIDTH - 16, window.innerHeight - h - 24));
  }, [open, position, clamp]);

  // Keep inside the viewport when the browser is resized
  useEffect(() => {
    if (!open) return;
    const onResize = () => setPosition((p) => (p ? clamp(p.x, p.y) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, clamp]);

  // Escape closes the window
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // ── Dragging ───────────────────────────────────

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !position) return;
    // Don't start a drag from header buttons
    if ((e.target as HTMLElement).closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    setIsDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragOffset.current) return;
    setPosition(clamp(e.clientX - dragOffset.current.x, e.clientY - dragOffset.current.y));
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragOffset.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragOffset.current = null;
    setIsDragging(false);
  };

  // ── Dice selection ─────────────────────────────

  const changeCount = (sides: number, delta: number) => {
    setCounts((prev) => {
      const next = Math.min(MAX_DICE_PER_GROUP, Math.max(0, (prev[sides] ?? 0) + delta));
      return next === prev[sides] ? prev : { ...prev, [sides]: next };
    });
    setBumpKey((prev) => ({ ...prev, [sides]: (prev[sides] ?? 0) + 1 }));
  };

  const modifier = (() => {
    const n = parseInt(modifierText, 10);
    if (Number.isNaN(n)) return 0;
    return Math.max(-MAX_MODIFIER, Math.min(MAX_MODIFIER, n));
  })();

  const changeModifier = (delta: number) => {
    setModifierText(String(Math.max(-MAX_MODIFIER, Math.min(MAX_MODIFIER, modifier + delta))));
  };

  const terms: DiceTerm[] = STANDARD_DICE.filter((d) => counts[d] > 0).map((d) => ({
    count: counts[d],
    sides: d,
    sign: 1 as const,
  }));
  const hasDice = terms.length > 0;
  const formula = hasDice ? formatFormula(terms, modifier) : "";
  const minTotal = terms.reduce((a, t) => a + t.count, 0) + modifier;
  const maxTotal = terms.reduce((a, t) => a + t.count * t.sides, 0) + modifier;

  const reset = () => {
    setCounts(emptyCounts());
    setModifierText("0");
  };

  const roll = () => {
    if (!hasDice) return;
    onRoll({ terms, modifier });
  };

  if (!open) return null;

  return (
    <div
      ref={windowRef}
      role="dialog"
      aria-label="Dice roller"
      id="dice-roller-window"
      className={`fixed z-50 layer-3-floating rounded-lg shadow-2xl shadow-black/50 animate-window-in select-none ${isDragging ? "cursor-grabbing" : ""}`}
      style={{
        width: WINDOW_WIDTH,
        left: position?.x ?? -9999,
        top: position?.y ?? -9999,
      }}
    >
      {/* Header / drag handle */}
      <div
        className={`flex items-center justify-between px-3 py-2.5 border-b border-border-subtle touch-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="flex items-center gap-2">
          <Dices className="w-4 h-4 text-primary" />
          <span className="font-semibold text-white text-[13px]">Dice Roller</span>
          <GripHorizontal className="w-3.5 h-3.5 text-text-muted/40" />
        </div>
        <div className="flex items-center gap-1">
          <button
            id="dice-reset-btn"
            type="button"
            onClick={reset}
            title="Clear"
            className="p-1.5 rounded text-text-muted hover:text-white hover:bg-surface-bright transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            id="dice-close-btn"
            type="button"
            onClick={onClose}
            title="Close (Esc)"
            className="p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* Dice grid */}
        <div>
          <div className="label-caps text-text-muted mb-2 flex justify-between">
            <span>Dice</span>
            <span className="text-text-muted/50 normal-case tracking-normal font-normal">
              click +1 · right-click −1
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {STANDARD_DICE.map((sides) => {
              const count = counts[sides];
              const active = count > 0;
              return (
                <div key={sides} className="relative group">
                  <button
                    id={`dice-add-d${sides}`}
                    type="button"
                    onClick={() => changeCount(sides, 1)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      changeCount(sides, -1);
                    }}
                    className={`w-full aspect-square flex flex-col items-center justify-center gap-1 rounded-md border transition-all duration-150 active:scale-95 ${
                      active
                        ? "border-primary/60 bg-primary/10 text-primary glow-primary"
                        : "border-border-subtle bg-surface-base/60 text-text-muted hover:text-white hover:border-primary/30 hover:bg-surface-container"
                    }`}
                  >
                    <DieIcon
                      sides={sides}
                      className={`w-6 h-6 transition-transform duration-200 ${active ? "" : "group-hover:rotate-12"}`}
                    />
                    <span className="font-telemetry text-[11px] font-semibold">d{sides}</span>
                  </button>

                  {active && (
                    <>
                      <span
                        key={bumpKey[sides]}
                        className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-primary text-background text-[10px] font-bold font-telemetry flex items-center justify-center pointer-events-none animate-count-bump"
                      >
                        {count}
                      </span>
                      <button
                        id={`dice-remove-d${sides}`}
                        type="button"
                        onClick={() => changeCount(sides, -1)}
                        title={`Remove one d${sides}`}
                        className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-surface-bright border border-border-subtle text-text-muted hover:text-white hover:bg-danger/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              );
            })}

            {/* Modifier tile fills the 8th grid slot */}
            <div className="aspect-square rounded-md border border-border-subtle bg-surface-base/60 flex flex-col items-center justify-center gap-0.5 px-1">
              <span className="label-caps text-text-muted/70 text-[9px]">MOD</span>
              <input
                id="dice-modifier-input"
                type="text"
                inputMode="numeric"
                value={modifierText}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^\d+-]/g, "");
                  if (/^[+-]?\d{0,4}$/.test(v)) setModifierText(v);
                }}
                onBlur={() => setModifierText(String(modifier))}
                onKeyDown={(e) => e.key === "Enter" && roll()}
                className={`w-full bg-transparent text-center font-telemetry text-[15px] font-bold focus:outline-none ${
                  modifier > 0 ? "text-success" : modifier < 0 ? "text-danger" : "text-text-muted"
                }`}
              />
              <div className="flex gap-1">
                <button
                  id="dice-modifier-dec"
                  type="button"
                  onClick={() => changeModifier(-1)}
                  className="w-5 h-4 rounded bg-surface-container hover:bg-surface-bright text-text-muted hover:text-white flex items-center justify-center transition-colors"
                >
                  <Minus className="w-2.5 h-2.5" />
                </button>
                <button
                  id="dice-modifier-inc"
                  type="button"
                  onClick={() => changeModifier(1)}
                  className="w-5 h-4 rounded bg-surface-container hover:bg-surface-bright text-text-muted hover:text-white flex items-center justify-center transition-colors"
                >
                  <Plus className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Formula preview */}
        <div className="layer-1-well rounded-md px-3 py-2.5 min-h-[52px] flex flex-col justify-center">
          {hasDice ? (
            <>
              <div className="font-telemetry text-[13px] text-white break-words">{formula}</div>
              <div className="font-telemetry text-[10px] text-text-muted mt-0.5">
                range <span className="text-danger/80">{minTotal}</span>
                {" – "}
                <span className="text-secondary/90">{maxTotal}</span>
              </div>
            </>
          ) : (
            <div className="font-telemetry text-[11px] text-text-muted/50">
              Select dice to build a roll…
            </div>
          )}
        </div>

        {/* Roll */}
        <button
          id="dice-roll-btn"
          type="button"
          onClick={roll}
          disabled={!hasDice}
          className="w-full py-2.5 rounded-md font-semibold text-[13px] flex items-center justify-center gap-2 transition-all duration-150 bg-primary text-background hover:brightness-110 glow-primary-hover active:scale-[0.98] disabled:bg-surface-container disabled:text-text-muted/50 disabled:cursor-not-allowed disabled:shadow-none"
        >
          <Dices className="w-4 h-4" />
          Roll
        </button>
      </div>
    </div>
  );
}
